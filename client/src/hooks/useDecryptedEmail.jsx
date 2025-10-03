// src/hooks/useDecryptedEmail.js (Corrected Version)

import { useState, useEffect, useMemo } from 'react';
import keyManager from '../services/keyManagerService';
import { decryptAES, processOTP } from '../services/encryptionService';

/**
 * A custom React hook to process and potentially decrypt an email's content.
 * It handles both standard and QuMail-encrypted emails.
 *
 * @param {object | null} email - The full email object from the local database.
 * @returns {{decryptionStatus: string, content: string, isHtml: boolean}}
 */
export const useDecryptedEmail = (email) => {
    // idle: no email selected
    // processing: actively working on the email
    // success: content is ready to be displayed
    // error: something went wrong
    const [decryptionStatus, setDecryptionStatus] = useState('idle');
    const [displayContent, setDisplayContent] = useState({ body: '', isHtml: false });

    useEffect(() => {
        // Reset state if no email is selected
        if (!email) {
            setDecryptionStatus('idle');
            setDisplayContent({ body: '', isHtml: false });
            return;
        }

        // --- PRIMARY LOGIC: Branch based on the encryption flag from the database ---
        if (email.is_qumail_encrypted) {
            setDecryptionStatus('processing');
            const encryptedPackage = email.body_plain || '';

            // Sanity check for the expected format in the plain text body
            if (!encryptedPackage.startsWith('---BEGIN QUMAIL MESSAGE---')) {
                console.error("Decryption Error: Email is flagged as encrypted, but the message format is missing.");
                setDisplayContent({ body: 'DECRYPTION FAILED: Expected QuMail message format, but it was not found.', isHtml: false });
                setDecryptionStatus('error');
                return;
            }

            try {
                // --- DECRYPTION LOGIC ---
                const parts = encryptedPackage.split('---');
                if (parts.length < 3) throw new Error("Malformed encrypted message.");

                const header = parts[1];
                const ciphertext = parts[2].trim();

                const sessionIdMatch = header.match(/SessionID: ([\w-]+)/);
                if (!sessionIdMatch) throw new Error("Encrypted message is missing a SessionID.");
                const sessionId = sessionIdMatch[1];
                
                // Use the protocol from the DB if available, otherwise parse from header
                const protocol = email.encryption_protocol || header.match(/Protocol: ([\w\s.+-]+)/)?.[1].trim();

                const key = keyManager.getKey(sessionId);
                if (!key) throw new Error("Decryption key not found. The handshake may be pending, failed, or the key was already used.");

                let plaintext = '';
                if (protocol && protocol.includes('OTP')) {
                    plaintext = processOTP(ciphertext, key);
                } else { // Assume AES for all other protocols
                    plaintext = decryptAES(ciphertext, key);
                }

                // Decrypted content is always treated as plain text for security.
                setDisplayContent({ body: plaintext, isHtml: false });
                setDecryptionStatus('success');

            } catch (error) {
                console.error("Decryption failed:", error);
                setDisplayContent({ body: `DECRYPTION FAILED: ${error.message}`, isHtml: false });
                setDecryptionStatus('error');
            }
        } else {
            // --- NORMAL (UNENCRYPTED) EMAIL PROCESSING ---
            // Prioritize the HTML body if it exists, otherwise fall back to plain text.
            if (email.body_html) {
                setDisplayContent({ body: email.body_html, isHtml: true });
            } else if (email.body_plain) {
                setDisplayContent({ body: email.body_plain, isHtml: false });
            } else {
                // Fallback for emails with no body content at all
                setDisplayContent({ body: '(This email has no content)', isHtml: false });
            }
            setDecryptionStatus('success');
        }

    }, [email]); // Re-run this logic whenever the selected email changes

    // useMemo prevents unnecessary re-renders in consuming components
    return useMemo(() => ({
        decryptionStatus,
        content: displayContent.body,
        isHtml: displayContent.isHtml
    }), [decryptionStatus, displayContent]);
};