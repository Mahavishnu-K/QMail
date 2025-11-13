/**
 * keyManagerService.js
 *
 * A secure, in-memory, session-based key manager. This service acts as a
 * temporary vault to store secret keys generated via QKD handshakes. It uses
 * a session ID to link a key to a specific email message.
 * This is implemented as a singleton to ensure a single key store for the app.
 */
import { decryptAES, processOTP } from './encryptionService'; 

class KeyManager {
    constructor() {
        // A Map is perfect for storing key-value pairs: { sessionId => secretKey }
        this.keyStore = new Map();
        console.log("Secure Key Manager initialized.");

    }

    async attemptPendingDecryptions() {
        if (this.keyStore.size === 0) {
            return; 
        }

        console.log(`KeyManager: Checking ${this.keyStore.size} pending key(s) against the database.`);
        // Iterate over a copy of the keys so we can safely delete from the map
        for (const [sessionId, keyHex] of this.keyStore.entries()) {
            const email = await window.electronAPI.findEmailBySessionId(sessionId);
            if (email) {
                console.log(`KeyManager: Found a matching email (ID: ${email.id}) for session ${sessionId}.`);
                // Found a match! Decrypt, update DB, and remove the key.
                await this.decryptAndUpdate(email, keyHex);
                this.keyStore.delete(sessionId); 
            }
        }
    }

    /**
     * Securely adds a newly generated key to the store.
     * @param {string} sessionId - The unique UUID for the handshake/email.
     * @param {string} keyHex - The secret key in hex format.
     */
    async addKey(sessionId, keyHex) {
        if (!sessionId || !keyHex) {
            console.error("KeyManager Error: Both sessionId and keyHex are required.");
            return;
        }

        const email = await window.electronAPI.findEmailBySessionId(sessionId);

        if (email) {
            // Happy path: Email arrived before the key. Decrypt immediately.
            console.log(`KeyManager: Received key for session ${sessionId} and found matching email immediately.`);
            await this.decryptAndUpdate(email, keyHex);
        } else {
            // Race condition: Key arrived before the email. Store the key and wait.
            console.warn(`KeyManager: Email for session ${sessionId} not found in cache yet. Storing key temporarily.`);
            this.keyStore.set(sessionId, keyHex);
        }
    }

    async decryptAndUpdate(email, keyHex) {
        try {
            const encryptedPackage = email.body_plain || '';
            if (!encryptedPackage.startsWith('---BEGIN QMail MESSAGE---')) {
                console.error(`Email ${email.id} is malformed.`);
                return;
            }

            const separatorIndex = encryptedPackage.lastIndexOf('\n---\n');
            if (separatorIndex === -1) {
                throw new Error("Malformed encrypted message: final separator not found.");
            }

            // The ciphertext is EVERYTHING after that final separator.
            const ciphertextPackage = encryptedPackage.substring(separatorIndex + 5).trim();

            const protocol = email.encryption_protocol || 'MF-QKD + AES-256';

            let plaintext = '';
            if (protocol.includes('OTP')) {
                plaintext = processOTP(ciphertextPackage, keyHex);
            } else {
                plaintext = decryptAES(ciphertextPackage, keyHex);
            }

            console.log(">>>> PLAINTEXT FROM DECRYPTION:", plaintext);
            console.log(`>>>> PLAINTEXT TYPE: ${typeof plaintext}, LENGTH: ${plaintext.length}`);

            if (plaintext.startsWith("Error:")) {
                throw new Error(plaintext);
            }

            const updates = {
                body_plain: plaintext,
                body_html: null,
                snippet: plaintext.substring(0, 100)
            };

            // --- ADD ANOTHER LOG BEFORE SENDING ---
            console.log(">>>> UPDATES BEING SENT TO MAIN PROCESS:", updates);

            // Tell the main process to update the email in the DB
            await window.electronAPI.updateEmailInDb({
                id: email.id,
                updates: {
                    body_plain: plaintext,
                    body_html: null, // Always clear HTML for security
                    snippet: plaintext.substring(0, 100) // Create a new snippet from plaintext
                }
            });

            console.log(`SUCCESS: Decrypted email ${email.id} and updated it in the local database.`);
        } catch (error) {
            console.error(`Error during decryption/update for email ${email.id}:`, error);
        }
    }

    /**
     * Retrieves a key for a given session ID.
     * For security, this can be designed to be a one-time-use operation.
     * @param {string} sessionId - The sessionId to look up.
     * @returns {string | undefined} The key if found, otherwise undefined.
     */
    getKeyForSending(sessionId) {
        if (!this.keyStore.has(sessionId)) {
            return undefined;
        }
        const key = this.keyStore.get(sessionId);
        this.keyStore.delete(sessionId); // Atomically get and delete
        console.log(`KeyManager (Sender): Retrieved and removed key for session ${sessionId} to send email.`);
        return key;
    }

    storeKeyForSending(sessionId, keyHex) {
        if (!sessionId || !keyHex) return;
        this.keyStore.set(sessionId, keyHex);
        console.log(`KeyManager (Sender): Stored key for session ${sessionId}.`);
    }
}

// Export a single instance of the KeyManager (Singleton pattern)
const keyManager = new KeyManager();
export default keyManager;