// client/src/contexts/PendingSessionContext.jsx (Final Optimized Version)

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './webSocketContext';
import { useAuth } from './AuthContext';
import keyManager from '../services/keyManagerService';
import { sendFinalEmail } from '../services/api';
import { encryptAES } from '../services/encryptionService';
import { respondToQKDHandshakeAsBob, initiateQKDHandshakeAsAlice } from '../services/qkdService';

const PendingSessionContext = createContext(null);

export const PendingSessionProvider = ({ children }) => {
    const { socket } = useWebSocket();
    const { user } = useAuth();
    
    const [pendingRequests, setPendingRequests] = useState([]);
    const [parkedEmails, setParkedEmails] = useState([]);
    
    // Use a Ref to give stable listeners access to the latest state.
    const parkedEmailsRef = useRef(parkedEmails);
    useEffect(() => {
        parkedEmailsRef.current = parkedEmails;
    }, [parkedEmails]);

    useEffect(() => {
        const loadParkedEmails = async () => {
            try {
                const emailsFromDb = await window.electronAPI.getAllParkedEmails();
                console.log(`Loaded ${emailsFromDb.length} parked emails from the database.`);
                setParkedEmails(emailsFromDb);
            } catch (err) {
                console.error("Failed to load parked emails from DB:", err);
            } 
        };
        loadParkedEmails();
    }, []);

    // This useEffect is the "Initiation Engine" for newly parked emails.
    useEffect(() => {
        if (!socket || !user) return;

        const newEmailToInitiate = parkedEmails.find(email => email.status === 'initiating');

        if (newEmailToInitiate) {
            console.log(`New parked email detected. Checking recipient status for session: ${newEmailToInitiate.session_id}`);
            socket.emit('check_user_status', { user_id: newEmailToInitiate.recipientId });
        }
    }, [parkedEmails, socket, user]);

    // This single, stable useEffect manages all incoming socket event listeners.
    useEffect(() => {
        if (!socket || !user) return;

        const handleUserStatusResponse = ({ user_id, is_online }) => {
            const emailToInitiate = parkedEmailsRef.current.find(email => email.recipientId === user_id && email.status === 'initiating');

            if (emailToInitiate) {
                if (is_online) {
                    console.log(`Recipient ${user_id} is ONLINE. Initiating live handshake.`);
                    updateParkedEmailStatus(emailToInitiate.session_id, 'Attempting live handshake...');
                    initiateQKDHandshakeAsAlice({
                        websocket: socket,
                        onProgress: (status) => updateParkedEmailStatus(emailToInitiate.session_id, status),
                        recipientId: emailToInitiate.recipientId,
                        senderId: user.id,
                        session_id: emailToInitiate.session_id,
                        to_email: emailToInitiate.recipient,
                        protocol: emailToInitiate.protocol.includes('BB84') ? 'BB84' : 'MF-QKD'
                    })
                    .then(finalKey => {
                        console.log(`SENDER'S FINAL KEY IS: ${finalKey}`);
                        keyManager.storeKeyForSending(emailToInitiate.session_id, finalKey)
                    })
                    .catch(err => {
                        console.error(`Failed to initiate pending handshake: ${err.message}`);
                        updateParkedEmailStatus(emailToInitiate.session_id, `Failed: ${err.message}`)
                    });
                } else {
                    console.log(`Recipient ${user_id} is OFFLINE. Notifying server to store pending session.`);
            
                    socket.emit('store_pending_session', {
                        session_id: emailToInitiate.session_id,
                        initiator_id: user.id,
                        recipient_id: emailToInitiate.recipientId,
                        initiator_email: user.email,
                        recipient_email: emailToInitiate.recipient
                    });

                    updateParkedEmailStatus(emailToInitiate.session_id, 'pending');
                }
            }
        };

        const handlePendingRequest = (request) => {
            console.log("Received a pending handshake request:", request);
            setPendingRequests(prev => [...prev, request]);
        };

        const handleRecipientOffline = ({ session_id }) => {
            updateParkedEmailStatus(session_id, 'pending');
        };
        
        const handleQkdInitiate = (payload) => {
            console.groupCollapsed(`[INCOMING HANDSHAKE] Session: ${payload.session_id}`);
            console.log("RECEIVER: Received 'qkd_initiate' from server.");
            console.log("Payload contains public photon states from sender:", payload);

            const { session_id } = payload;
            if (!session_id) {
                console.error("Incoming QKD request is missing a session_id. Aborting.");
                return;
            }

            const isMyOwnSession = parkedEmailsRef.current.some(email => email.session_id === session_id);
            if (isMyOwnSession) {
                console.warn(`Ignoring 'qkd_initiate' for my own session: ${session_id}`);
                return;
            }
            respondToQKDHandshakeAsBob(payload, { 
                websocket: socket, 
                onProgress: (progress) => console.log(`RECEIVER:${progress}`), 
                myId: user.id, 
                session_id: session_id 
            })
            .then(finalKey => {
                console.log(`PendingContext: RECEIVER'S FINAL KEY IS: ${finalKey}`);
                console.log("SUCCESS: Securely received key from incoming handshake:", finalKey);
                keyManager.addKey(session_id, finalKey)
            })
            .catch(err => {
                console.error("Incoming handshake failed:", err)
            });
        };

        const handleInitiateFromPending = (payload) => {
            const { session_id, to: recipientId } = payload;
            const parkedEmail = parkedEmailsRef.current.find(email => email.session_id === session_id);
            if (parkedEmail) {
                console.log(`Received nudge for session: ${session_id}. Re-initiating as Alice.`);
                initiateQKDHandshakeAsAlice({
                    websocket: socket,
                    onProgress: (status) => updateParkedEmailStatus(session_id, status),
                    recipientId: recipientId,
                    senderId: user.id,
                    session_id: session_id,
                    to_email: parkedEmail.recipient,
                    protocol: parkedEmail.protocol.includes('BB84') ? 'BB84' : 'MF-QKD'
                })
                .then(finalKey => {
                    console.log(`SENDER'S FINAL KEY IS: ${finalKey}`);
                    keyManager.storeKeyForSending(session_id, finalKey)
                })
                .catch(err => {
                    console.error(`Failed to re-initiate pending handshake: ${err.message}`);
                    updateParkedEmailStatus(session_id, `Failed: ${err.message}`)
                });
            }
        };

        socket.on('user_status_response', handleUserStatusResponse);
        socket.on('qkd_pending_request', handlePendingRequest);
        socket.on('qkd_initiate', handleQkdInitiate);
        socket.on('qkd_recipient_offline', handleRecipientOffline);
        socket.on('initiate_from_pending', handleInitiateFromPending);

        return () => {
            socket.off('user_status_response', handleUserStatusResponse);
            socket.off('qkd_pending_request', handlePendingRequest);
            socket.off('qkd_initiate', handleQkdInitiate);
            socket.off('qkd_recipient_offline', handleRecipientOffline);
            socket.off('initiate_from_pending', handleInitiateFromPending);
        };
    }, [socket, user]); // Stable dependency array.

    // This useEffect is the "Sending Engine" for emails whose keys have been generated.
    useEffect(() => {
        if (parkedEmails.length === 0) return;
        const checkAllParkedEmails = () => {
            for (const email of parkedEmails) {
                const key = keyManager.getKeyForSending(email.session_id);
                if (key) {
                    console.log(`Key found for parked email to ${email.recipient}. Sending now...`);
                    (async () => {
                        try {
                            const finalCiphertext = `---BEGIN QMail MESSAGE---\nProtocol: ${email.protocol}\nSessionID: ${email.session_id}\n---\n${encryptAES(email.body, key)}`;
                            await sendFinalEmail({
                                recipient: email.recipient, 
                                subject: email.subject, 
                                body: finalCiphertext,
                                is_encrypted: true, 
                                protocol: email.protocol,
                            });
                            console.log(`Successfully sent email for session ${email.session_id}`);
                            
                            updateParkedEmailStatus(email.session_id, "sent");
                            if (email.onSendSuccess) { 
                                email.onSendSuccess();
                            }
                            if (socket && email.recipientId) {
                                socket.emit('new_mail_notification', { 
                                    to: email.recipientId, 
                                    folder: 'INBOX' 
                                });
                            } else {
                                console.warn('Could not send instant sync notification: socket or recipientId missing.', {
                                    hasSocket: !!socket,
                                    recipientId: email.recipientId
                                }); 
                            }
                            
                        } catch (err) {
                            console.error("Failed to send parked email after getting key:", err);
                            updateParkedEmailStatus(email.session_id, `Failed: ${err.message}`);
                        }
                    })();
                }
            }
        };
        const intervalId = setInterval(checkAllParkedEmails, 2000);
        return () => clearInterval(intervalId);
    }, [parkedEmails, socket]);

    const parkEmailForSending = (emailData, onSendSuccess) => {
        setParkedEmails(prev => [...prev, { ...emailData, status: 'initiating', onSendSuccess }]);
    };
    
    const removeParkedEmail = useCallback(async (sessionId) => {
        await window.electronAPI.removeParkedEmail(sessionId);
        setParkedEmails(prev => prev.filter(email => email.session_id !== sessionId));
    }, []);

    const updateParkedEmailStatus = useCallback(async (sessionId, status) => {
        await window.electronAPI.updateParkedEmailStatus({ sessionId, status });
        setParkedEmails(prev =>
            prev.map(email =>
                email.session_id === sessionId ? { ...email, status } : email
            )
        );
    }, []);

    const removePendingRequest = (sessionId) => {
        setPendingRequests(prev => prev.filter(req => req.session_id !== sessionId));
    };

    const value = { parkedEmails, pendingRequests, parkEmailForSending, updateParkedEmailStatus, removeParkedEmail, removePendingRequest };

    return (
        <PendingSessionContext.Provider value={value}>
            {children}
        </PendingSessionContext.Provider>
    );
};

export const usePendingSession = () => {
    return useContext(PendingSessionContext);
};