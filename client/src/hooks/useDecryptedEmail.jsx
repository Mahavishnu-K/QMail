// src/hooks/useDecryptedEmail.js (Corrected Version)

import { useState, useEffect, useMemo } from 'react';

export const useDecryptedEmail = (email, currentFolder) => {

    const [decryptionStatus, setDecryptionStatus] = useState('idle');
    const [displayContent, setDisplayContent] = useState({ body: '', isHtml: false });

    useEffect(() => {
        // Reset state if no email is selected
        if (!email) {
            setDecryptionStatus('idle');
            setDisplayContent({ body: '', isHtml: false });
            return;
        }

        const processEmail = async() =>{
            if (email.is_qumail_encrypted) {
                const body = email.body_plain || '';

                if (currentFolder === 'SENT' && email.session_id) {
                    const sentItemFromCache = await window.electronAPI.getFromSecureSentCache(email.session_id);
                    if (sentItemFromCache) {
                        setDecryptionStatus('success');
                        setDisplayContent({ body: sentItemFromCache.body ?? '', isHtml: false });
                        return; 
                    }
                }

                if (body.startsWith('---BEGIN QMail MESSAGE---')) {
                    setDecryptionStatus('processing'); 
                    setDisplayContent({ body: 'Waiting for decryption key to arrive...', isHtml: false });
                } else {
                    setDecryptionStatus('success');
                    setDisplayContent({ body: body, isHtml: false }); 
                }
            } else {
                if (email.body_html) {
                    setDisplayContent({ body: email.body_html, isHtml: true });
                } else {
                    setDisplayContent({ body: email.body_plain || '(This email has no content)', isHtml: false });
                }
                setDecryptionStatus('success');
            }
        };

        processEmail();

    }, [email]); 

    return useMemo(() => ({
        decryptionStatus,
        content: displayContent.body,
        isHtml: displayContent.isHtml
    }), [decryptionStatus, displayContent]);
};