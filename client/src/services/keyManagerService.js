/**
 * keyManagerService.js
 *
 * A secure, in-memory, session-based key manager. This service acts as a
 * temporary vault to store secret keys generated via QKD handshakes. It uses
 * a session ID to link a key to a specific email message.
 * This is implemented as a singleton to ensure a single key store for the app.
 */

class KeyManager {
    constructor() {
        // A Map is perfect for storing key-value pairs: { sessionId => secretKey }
        this.keyStore = new Map();
        console.log("Secure Key Manager initialized.");
    }

    /**
     * Securely adds a newly generated key to the store.
     * @param {string} sessionId - The unique UUID for the handshake/email.
     * @param {string} keyHex - The secret key in hex format.
     */
    addKey(sessionId, keyHex) {
        if (!sessionId || !keyHex) {
            console.error("KeyManager Error: Both sessionId and keyHex are required.");
            return;
        }
        this.keyStore.set(sessionId, keyHex);
        console.log(`KeyManager: Stored key for session ${sessionId}`);
    }

    /**
     * Retrieves a key for a given session ID.
     * For security, this can be designed to be a one-time-use operation.
     * @param {string} sessionId - The sessionId to look up.
     * @returns {string | undefined} The key if found, otherwise undefined.
     */
    getKey(sessionId) {
        if (!this.keyStore.has(sessionId)) {
            console.warn(`KeyManager: No key found for session ${sessionId}`);
            return undefined;
        }
        const key = this.keyStore.get(sessionId);
        
        // Optional but highly recommended for security:
        // Once a key is used for decryption, remove it.
        this.removeKey(sessionId); 
        
        console.log(`KeyManager: Retrieved and removed key for session ${sessionId}`);
        return key;
    }

    /**
     * Removes a key from the store.
     * @param {string} sessionId - The sessionId of the key to remove.
     */
    removeKey(sessionId) {
        this.keyStore.delete(sessionId);
    }
}

// Export a single instance of the KeyManager (Singleton pattern)
const keyManager = new KeyManager();
export default keyManager;