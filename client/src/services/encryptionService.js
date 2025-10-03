import CryptoJS from 'crypto-js';

/**
 * Encrypts plaintext using AES-256-CBC.
 * @param {string} plaintext - The message to encrypt.
 * @param {string} keyHex - The 256-bit key as a hex string.
 * @returns {string} - A string containing iv:ciphertext, both hex-encoded.
 */
export const encryptAES = (plaintext, keyHex) => {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.lib.WordArray.random(128 / 8); // 16 bytes IV

    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    // Combine IV and ciphertext for easy storage and decryption
    return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
};

/**
 * Decrypts an AES-256-CBC ciphertext package.
 * @param {string} ciphertextPackage - The "iv:ciphertext" string.
 * @param {string} keyHex - The 256-bit key as a hex string.
 * @returns {string} - The original plaintext.
 */
export const decryptAES = (ciphertextPackage, keyHex) => {
    try {
        const [ivHex, ciphertextHex] = ciphertextPackage.split(':');
        if (!ivHex || !ciphertextHex) throw new Error('Invalid ciphertext package format.');

        const key = CryptoJS.enc.Hex.parse(keyHex);
        const iv = CryptoJS.enc.Hex.parse(ivHex);
        const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);

        const decrypted = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption failed:", e);
        return "Error: Could not decrypt this message. The key may be incorrect.";
    }
};

// Note: A true OTP in JS is complex with character encoding.
// This is a simplified educational example assuming ASCII.
/**
 * Encrypts/Decrypts plaintext using One-Time Pad (XOR).
 * @param {string} text - The plaintext or ciphertext string.
 * @param {string} keyHex - The key as a hex string, MUST be >= text length.
 * @returns {string} - The resulting text.
 */
export const processOTP = (text, keyHex) => {
    if (keyHex.length < text.length * 2) {
        throw new Error("OTP key must be at least as long as the message.");
    }
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const textCharCode = text.charCodeAt(i);
        const keyByte = parseInt(keyHex.substr(i * 2, 2), 16);
        result += String.fromCharCode(textCharCode ^ keyByte);
    }
    return result;
};