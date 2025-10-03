import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/webSocketContext';
import { checkQuMailUser, sendFinalEmail } from '../services/api';
import { initiateQKDHandshakeAsAlice, generatePQCSharedSecret } from '../services/qkdService';
import { encryptAES, processOTP } from '../services/encryptionService';
import SecurityDropdown from '../components/specific/securityDropdown';
import HandshakeAnimation from '../components/specific/HandshakeAnimation';

// Debounce helper
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

const ComposePage = ({ activeAccount, onClose }) => {
    const [recipient, setRecipient] = useState('');
    const [recipientInfo, setRecipientInfo] = useState({ isQuMailUser: false, id: null });
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isCheckingUser, setIsCheckingUser] = useState(false);
    const [securityLevel, setSecurityLevel] = useState('LEVEL_5_NONE');
    const [isSending, setIsSending] = useState(false);
    const [handshakeStatus, setHandshakeStatus] = useState('');
    const [error, setError] = useState('');

    const { socket } = useWebSocket();
    const auth = useAuth(); 

    const checkRecipient = async (email) => {
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
             setRecipientInfo({ isQuMailUser: false, id: null });
            return;
        }
        setIsCheckingUser(true);
        try {
            const response = await checkQuMailUser(email);
            // **CRITICAL FIX**: Store both the status AND the recipient's user ID
            setRecipientInfo({
                isQuMailUser: response.data.is_qumail_user,
                id: response.data.user_id 
            });
        } catch (error) {
             setRecipientInfo({ isQuMailUser: false, id: null });
        } finally {
            setIsCheckingUser(false);
        }
    };
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedCheckRecipient = useCallback(debounce(checkRecipient, 500), []);

    useEffect(() => {
        debouncedCheckRecipient(recipient);
    }, [recipient, debouncedCheckRecipient]);

    useEffect(() => {
        setSecurityLevel(recipientInfo.isQuMailUser ? 'LEVEL_2_MF_AES' : 'LEVEL_5_NONE');
    }, [recipientInfo.isQuMailUser]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (securityLevel !== 'LEVEL_5_NONE' && !recipientInfo.id) {
            setError("Cannot send secure message: Recipient ID not found.");
            return;
        }

        setIsSending(true);
        setError('');
        setHandshakeStatus('Preparing to send...');
        
        try {
            let finalCiphertext = body;
            let protocolUsed = 'None';
            let key;
            const session_id = crypto.randomUUID();

            if (securityLevel !== 'LEVEL_5_NONE') {
                console.log("Generated new session ID for secure send:", session_id);

                const handshakeOptions = {
                    onProgress: setHandshakeStatus,
                    websocket: socket,
                    recipientId: recipientInfo.id, 
                    senderId: auth.user.id,
                    session_id: session_id        
                };

                switch (securityLevel) {
                    case 'LEVEL_1_OTP':
                        key = await initiateQKDHandshakeAsAlice({ ...handshakeOptions, protocol: 'MF-QKD', keyLengthBits: body.length * 8 });
                        const otpCiphertext = processOTP(body, key);
                        finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: MF-QKD + OTP\nSessionID: ${session_id}\n---\n${otpCiphertext}`;
                        protocolUsed = 'MF-QKD + OTP';
                        break;
                    case 'LEVEL_2_MF_AES':
                        key = await initiateQKDHandshakeAsAlice({ ...handshakeOptions, protocol: 'MF-QKD', keyLengthBits: 256 });
                        const encryptedBody = encryptAES(body, key);
                        finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: MF-QKD + AES-256\nSessionID: ${session_id}\n---\n${encryptedBody}`;
                        protocolUsed = 'MF-QKD + AES-256';
                        break;
                    case 'LEVEL_3_PQC':
                        key = await generatePQCSharedSecret({ onProgress: setHandshakeStatus });
                        const pqcCiphertext = encryptAES(body, key);
                        finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: PQC + AES-256\nSessionID: ${session_id}\n---\n${pqcCiphertext}`;
                        protocolUsed = 'PQC (Simulated) + AES-256';
                        break;
                    case 'LEVEL_4_BB84_AES':
                        key = await initiateQKDHandshakeAsAlice({ ...handshakeOptions, protocol: 'BB84', keyLengthBits: 256 });
                        const aesCiphertextBB84 = encryptAES(body, key);
                        finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: BB84 + AES-256\nSessionID: ${session_id}\n---\n${aesCiphertextBB84}`;
                        protocolUsed = 'BB84 + AES-256';
                        break;
                    case 'LEVEL_5_NONE':
                        break;
                    default:
                        throw new Error("Invalid security level.");
                }
            }
            
            setHandshakeStatus('Transmitting email...');
            await sendFinalEmail({
                recipient, subject, body: finalCiphertext,
                is_encrypted: securityLevel !== 'LEVEL_5_NONE', protocol: protocolUsed,
            });
            setHandshakeStatus('Email Sent Successfully!');
            setTimeout(() => onClose(true), 1500);

        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
            setHandshakeStatus(`Failed: ${err.message}`);
            setIsSending(false);
        }
    };

    return (
        <div className="flex-1 p-8 bg-white">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">New Message</h2>
            <form onSubmit={handleSend}>
                <div className="mb-4">
                    <input type="email" placeholder="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
                    {isCheckingUser && <p className="text-xs text-gray-500 mt-1">Checking recipient status...</p>}
                </div>
                <div className="mb-4">
                    <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" required />
                </div>
                <div className="mb-4">
                   <SecurityDropdown 
                     selectedLevel={securityLevel}
                     onLevelChange={setSecurityLevel}
                     disabled={isSending || !recipientInfo.isQuMailUser}
                     isRecipientQuMailUser={recipientInfo.isQuMailUser}
                   />
                </div>
                <div className="mb-6">
                    <textarea rows="15" placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"></textarea>
                </div>
                {isSending && <div className="mb-4"><HandshakeAnimation status={handshakeStatus} error={error} /></div>}
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={() => onClose(false)} disabled={isSending} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" disabled={isSending} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-300">
                        {isSending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ComposePage; 