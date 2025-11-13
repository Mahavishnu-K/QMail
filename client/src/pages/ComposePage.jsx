import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/webSocketContext';
import { checkQuMailUser, sendFinalEmail } from '../services/api';
import { generatePQCSharedSecret } from '../services/qkdService';
import { encryptAES, processOTP } from '../services/encryptionService';
import SecurityDropdown from '../components/specific/securityDropdown';
import HandshakeAnimation from '../components/specific/HandshakeAnimation';
import { usePendingSession } from '../contexts/PendingContext';

// Debounce helper
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

const ComposePage = () => {
    const [recipient, setRecipient] = useState('');
    const [recipientInfo, setRecipientInfo] = useState({ isQuMailUser: false, id: null });
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isCheckingUser, setIsCheckingUser] = useState(false);
    const [securityLevel, setSecurityLevel] = useState('LEVEL_5_NONE');
    const [isSending, setIsSending] = useState(false);
    const [handshakeStatus, setHandshakeStatus] = useState('');
    const [error, setError] = useState('');
    const [isSendComplete, setIsSendComplete] = useState(false);
    const [view, setView] = useState('FORM');

    const { socket } = useWebSocket();
    const auth = useAuth(); 
    const { parkEmailForSending, updateParkedEmailStatus } = usePendingSession();

    const navigate = useNavigate();

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
        setView('SUMMARY');
        setError('');
        setHandshakeStatus('Preparing to send...');
        
        const session_id = crypto.randomUUID();

        // --- FLOW 1: Standard Unencrypted Email ---
        if (securityLevel === 'LEVEL_5_NONE') {
            try {
                setHandshakeStatus('Transmitting email...');
                await sendFinalEmail({ recipient, subject, body, is_encrypted: false, protocol: 'None' });
                setHandshakeStatus('Email Sent Successfully!');
                setIsSendComplete(true);

                if (socket && recipientInfo.id) {
                    console.log('Sending instant sync notification to recipient.');
                    socket.emit('new_mail_notification', {
                        to: recipientInfo.id,
                        folder: 'INBOX' 
                    });
                }

            } catch (err) {
                setError(err.message);
                setHandshakeStatus('Failed to send.');
                setIsSending(false);
            }
            return;
        }

        // --- FLOW 2: Asynchronous PQC Email ---
        if (securityLevel === 'LEVEL_3_PQC') {
            try {
                const key = await generatePQCSharedSecret({ onProgress: setHandshakeStatus });
                const ciphertext = encryptAES(body, key);
                const finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: PQC + AES-256\nSessionID: ${session_id}\n---\n${ciphertext}`;
                const protocolUsed = 'PQC (Simulated) + AES-256';
                
                setHandshakeStatus('Transmitting email...');
                await sendFinalEmail({ recipient, subject, body: finalCiphertext, is_encrypted: true, protocol: protocolUsed });
                setHandshakeStatus('Email Sent Successfully!');
                setIsSendComplete(true);

                if (socket && recipientInfo.id) {
                    console.log('Sending instant sync notification to recipient.');
                    socket.emit('new_mail_notification', {
                        to: recipientInfo.id,
                        folder: 'INBOX'
                    });
                }
            } catch (err) {
                setError(err.message);
                setHandshakeStatus(`Failed: ${err.message}`);
                setIsSending(false);
            }
            return;
        }

        // --- FLOW 3: Live QKD (Store-and-Forward capable) ---
        if (['LEVEL_1_OTP', 'LEVEL_2_MF_AES', 'LEVEL_4_BB84_AES'].includes(securityLevel)) {
            // Step 1: Park the email data in the context.
            const protocolUsed = {
                'LEVEL_1_OTP': 'MF-QKD + OTP',
                'LEVEL_2_MF_AES': 'MF-QKD + AES-256',
                'LEVEL_4_BB84_AES': 'BB84 + AES-256'
            }[securityLevel];

            const handleSuccessfulSend = () => {
                setHandshakeStatus("Secure Email Sent Successfully!");
                setIsSendComplete(true);
            };

            const parkedEmailData = {
                session_id: session_id,
                recipient: recipient,
                recipientId: recipientInfo.id,
                subject: subject,
                body: body,
                protocol: protocolUsed,
                status: 'initiating' 
            };
            await window.electronAPI.addToSecureSentCache(parkedEmailData);
            parkEmailForSending(parkedEmailData, handleSuccessfulSend);

            setView('SUMMARY');
            setHandshakeStatus('Attempting live handshake...');
        }
    };

    if (view === 'SUMMARY') {
        const isQkdPending = ['LEVEL_1_OTP', 'LEVEL_2_MF_AES', 'LEVEL_4_BB84_AES'].includes(securityLevel);

        return (
            <div className="flex-1 p-8 bg-white text-center flex flex-col items-center justify-center">
                <div className="max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">Send Status</h2>
                    <div className="mb-4">
                        <HandshakeAnimation status={handshakeStatus} error={error} />
                    </div>
                    
                    {!error && ( // Only show a message if there is no error
                        <p className="text-sm text-gray-500 mt-4 px-4">
                            {isQkdPending && !isSendComplete && (
                                <>
                                    If the recipient is offline, this message is now pending.
                                    <br/>
                                    You can monitor its status in your Notifications Panel.
                                </>
                            )}
                            {isSendComplete && (
                                <>
                                    Sent successfully.
                                </>
                            )}
                        </p>
                    )}
                    
                    <div className="mt-8">
                        <button 
                            onClick={() => navigate('/folder/inbox')} 
                            className="bg-blue-600 text-white font-bold py-2 px-8 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Okay
                        </button>
                    </div>
                </div>
            </div>
        );
    }


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
                    <button type="button" onClick={() => navigate(-1)} disabled={isSending} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" disabled={isSending} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-300">
                        {isSending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ComposePage; 