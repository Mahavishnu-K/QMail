import CryptoJS from 'crypto-js';

/**
 * Encrypts plaintext using AES-256-CBC.
 * @param {string} plaintext - The message to encrypt.
 * @param {string} keyHex - The 256-bit key as a hex string.
 * @returns {string} - A string containing iv_base64:ciphertext_base64.
 */
export const encryptAES = (plaintext, keyHex) => {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    console.log(">>>> [Inside encryptAES] Raw plaintext:", plaintext);
    console.log(">>>> [Inside encryptAES] Plaintext length:", plaintext.length);

    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    console.log(">>>> [Inside encryptAES] encrypted:", encrypted);

    // --- THE FIX: Use Base64 instead of Hex ---
    const ivBase64 = CryptoJS.enc.Base64.stringify(iv);
    const ciphertextBase64 = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
    
    console.log(">>>> [Inside encryptAES] ivBase64 + ':' + ciphertextBase64:", ivBase64 + ':' + ciphertextBase64);
    

    return ivBase64 + ':' + ciphertextBase64;
};

/**
 * Decrypts an AES-256-CBC ciphertext package.
 * @param {string} ciphertextPackage - The "iv_base64:ciphertext_base64" string.
 * @param {string} keyHex - The 256-bit key as a hex string.
 * @returns {string} - The original plaintext.
 */
export const decryptAES = (ciphertextPackage, keyHex) => {
    try {
        const [ivBase64, ciphertextBase64] = ciphertextPackage.split(':');
        if (!ivBase64 || !ciphertextBase64) throw new Error('Invalid ciphertext package format.');

        console.log(">>>> [Inside decryptAES] ivBase64:", ivBase64);
        console.log(">>>> [Inside decryptAES] ciphertextBase64:", ciphertextBase64);

        const key = CryptoJS.enc.Hex.parse(keyHex);
        
        // --- THE FIX: Parse from Base64 instead of Hex ---
        const iv = CryptoJS.enc.Base64.parse(ivBase64);
        const ciphertext = CryptoJS.enc.Base64.parse(ciphertextBase64);

        const decrypted = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
        console.log(">>>> [Inside decryptAES] Raw plaintext:", plaintext);
        console.log(">>>> [Inside decryptAES] Plaintext length:", plaintext.length);

        // Add a check to see if the output is valid. If not, the key was wrong.
        if (plaintext.length === 0 && decrypted.sigBytes > 0) {
            throw new Error("Malformed UTF-8 data after decryption.");
        }
        
        if (!plaintext) {
            throw new Error("Decryption resulted in empty plaintext.");
        }

        return plaintext;

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