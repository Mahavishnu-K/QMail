import CryptoJS from 'crypto-js';

// ... (CONSTANTS AND HELPER FUNCTIONS remain exactly the same) ...
const QBER_THRESHOLDS = { 'BB84': 0.15, 'MF-QKD': 0.08 };
const SAMPLE_SIZE = 0.5;
const RAW_KEY_TARGET_BITS = 512; 
const PHOTON_MULTIPLIER = 10;  
const TARGET_KEY_BITS = 256; 

const STATE_MAP_BB84 = { '00': 0, '10': 1, '01': 2, '11': 3 };
const INVERSE_STATE_MAP_BB84 = { 0: {bit:0, basis:0}, 1: {bit:1, basis:0}, 2: {bit:0, basis:1}, 3: {bit:1, basis:1} };
const STATE_MAP_MF = { '000': 0, '100': 1, '010': 2, '110': 3, '001': 4, '101': 5, '011': 6, '111': 7 };
const INVERSE_STATE_MAP_MF = {
    0: {bit:0, basis:0, orientation:0}, 1: {bit:1, basis:0, orientation:0},
    2: {bit:0, basis:1, orientation:0}, 3: {bit:1, basis:1, orientation:0},
    4: {bit:0, basis:0, orientation:1}, 5: {bit:1, basis:0, orientation:1},
    6: {bit:0, basis:1, orientation:1}, 7: {bit:1, basis:1, orientation:1}
};

const _generateRandomArray = (len) => Array.from({ length: len }, () => Math.round(Math.random()));
function _alicePreparesData(numPhotons, protocol) { /* ... no changes ... */ }
function _bobMeasuresData(receivedStates, protocol) { /* ... no changes ... */ }
function _getSiftIndices(myBases, theirBases, myOrientations, theirOrientations, protocol) { /* ... no changes ... */ }
function _getSiftedKey(privateBits, siftIndices) { /* ... no changes ... */ }
function _performErrorCheck(mySiftedKey, theirSample) { /* ... no changes ... */ }
function _deriveFixedLengthKey(rawKey) { /* ... no changes ... */ }
// --- (END of unchanged section) ---

// --- THE HANDSHAKE MANAGER ---
class QKDHandshakeManager {
    constructor(websocket, onProgress, senderId, recipientId, sessionId) { // MODIFIED
        this.ws = websocket;
        this.onProgress = onProgress;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.sessionId = sessionId; // CRITICAL FIX: Store the session ID
        this.resolve = null;
        this.reject = null;

        // Bind listeners
        this.ws.on('qkd_bob_bases', this._handleBobBases.bind(this));
        this.ws.on('qkd_alice_bases', this._handleAliceBases.bind(this));
        this.ws.on('qkd_alice_sample', this._handleAliceSample.bind(this));
        this.ws.on('qkd_handshake_complete', this._handleSuccessConfirmation.bind(this));
    }

    cleanup() {
        this.ws.off('qkd_bob_bases', this._handleBobBases.bind(this));
        this.ws.off('qkd_alice_bases', this._handleAliceBases.bind(this));
        this.ws.off('qkd_alice_sample', this._handleAliceSample.bind(this));
        this.ws.off('qkd_handshake_complete', this._handleSuccessConfirmation.bind(this));
    }

    // --- ALICE'S FLOW ---
    startAsAlice(protocol) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve; this.reject = reject;
            this.protocol = protocol;

            this.onProgress('Preparing quantum states...');
            const numPhotons = RAW_KEY_TARGET_BITS * PHOTON_MULTIPLIER;
            const { privateData, publicPayload } = _alicePreparesData(numPhotons, this.protocol);
            this.alicePrivate = privateData;

            this.onProgress('Transmitting quantum states...');
            this.ws.emit('qkd_initiate', { 
                to: this.recipientId, 
                from: this.senderId, 
                protocol: this.protocol, 
                session_id: this.sessionId, // CRITICAL FIX: Send the session ID
                ...publicPayload 
            });
        });
    }

    _handleBobBases(payload) {
        if (payload.from !== this.recipientId || payload.session_id !== this.sessionId) return;
        this.onProgress('Received Bob\'s bases. Sifting...');
        const siftIndices = _getSiftIndices(this.alicePrivate.bases, payload.bases, this.alicePrivate.orientations, payload.orientations, this.protocol);
        this.aliceSiftedKey = _getSiftedKey(this.alicePrivate.bits, siftIndices);

        this.onProgress('Sifting complete. Sending my bases...');
        this.ws.emit('qkd_alice_bases', { to: this.recipientId, from: this.senderId, session_id: this.sessionId, bases: this.alicePrivate.bases, orientations: this.alicePrivate.orientations });

        const numSamples = Math.floor(this.aliceSiftedKey.length * SAMPLE_SIZE);
        const sampleIndices = Array.from(Array(this.aliceSiftedKey.length).keys()).sort(() => 0.5 - Math.random()).slice(0, numSamples);
        this.errorCheckSample = sampleIndices.map(i => ({ i, val: this.aliceSiftedKey[i] }));
        
        this.onProgress('Sending error check sample...');
        this.ws.emit('qkd_alice_sample', { to: this.recipientId, from: this.senderId, session_id: this.sessionId, sample: this.errorCheckSample });
    }
    
    _handleSuccessConfirmation(payload) {
        if (payload.from !== this.recipientId || payload.session_id !== this.sessionId) return;
        this.onProgress('Handshake confirmed by recipient. Deriving final key...');
        const { rawFinalKey } = _performErrorCheck(this.aliceSiftedKey, this.errorCheckSample);
        const finalEncryptionKey = _deriveFixedLengthKey(rawFinalKey);
        this.onProgress('Final key derived successfully!');
        this.resolve(finalEncryptionKey);
        this.cleanup();
    }

    // --- BOB'S FLOW ---
    handleInitiation(payload) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve; this.reject = reject;
            this.protocol = payload.protocol;

            this.onProgress('Quantum states received. Measuring...');
            this.bobPrivate = _bobMeasuresData(payload.photon_states, this.protocol);

            this.onProgress('Measurement complete. Sending my bases...');
            this.ws.emit('qkd_bob_bases', { to: this.recipientId, from: this.senderId, session_id: this.sessionId, bases: this.bobPrivate.bases, orientations: this.bobPrivate.orientations });
        });
    }
    
    _handleAliceBases(payload) {
        if (payload.from !== this.recipientId || payload.session_id !== this.sessionId) return;
        this.onProgress('Received Alice\'s bases. Sifting...');
        const siftIndices = _getSiftIndices(this.bobPrivate.bases, payload.bases, this.bobPrivate.orientations, payload.orientations, this.protocol);
        this.bobSiftedKey = _getSiftedKey(this.bobPrivate.measuredBits, siftIndices);
        this.onProgress('Sifting complete. Awaiting final sample check...');
    }

    _handleAliceSample(payload) {
        if (payload.from !== this.recipientId || payload.session_id !== this.sessionId) return;
        this.onProgress('Received error sample. Performing final verification...');
        const { rawFinalKey, qber } = _performErrorCheck(this.bobSiftedKey, payload.sample);
        this.onProgress(`QBER calculated: ${(qber * 100).toFixed(2)}%`);
        const qber_threshold = QBER_THRESHOLDS[this.protocol];

        if (qber > qber_threshold) {
             this.onProgress('SECURITY ALERT: High error rate detected!');
             this.reject(new Error(`QBER of ${(qber * 100).toFixed(2)}% exceeds threshold.`));
        } else {
            this.onProgress('Key verified. Deriving final encryption key...');
            const finalEncryptionKey = _deriveFixedLengthKey(rawFinalKey);
            
            this.ws.emit('qkd_handshake_complete', { to: this.recipientId, from: this.senderId, session_id: this.sessionId, status: 'success' });
            
            this.onProgress('Final key derived successfully!');
            this.resolve(finalEncryptionKey);
        }
        this.cleanup();
    }
}

// --- PRIMARY EXPORTED FUNCTIONS ---
export const initiateQKDHandshakeAsAlice = (options) => {
    const { websocket, onProgress, senderId, recipientId, protocol, session_id } = options; // MODIFIED
    if (!websocket || !websocket.connected) return Promise.reject(new Error("WebSocket is not connected."));
    const manager = new QKDHandshakeManager(websocket, onProgress, senderId, recipientId, session_id); // MODIFIED
    return manager.startAsAlice(protocol);
};

export const respondToQKDHandshakeAsBob = (payload, options) => {
    const { websocket, onProgress, myId, session_id } = options; // MODIFIED
    if (!websocket || !websocket.connected) return Promise.reject(new Error("WebSocket is not connected."));
    const manager = new QKDHandshakeManager(websocket, onProgress, myId, payload.from, session_id); // MODIFIED
    return manager.handleInitiation(payload);
};

// ... (generatePQCSharedSecret remains the same) ...