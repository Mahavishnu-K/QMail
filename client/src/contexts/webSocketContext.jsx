import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { respondToQKDHandshakeAsBob } from '../services/qkdService'; 
import keyManager from '../services/keyManagerService';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { isAuthenticated, user, token } = useAuth(); // We need the token for the query
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user && token) {
            // **CRITICAL FIX**: Pass the token in the auth query for the backend's secure WS dependency
            const connectionUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            
            const socket = io(connectionUrl, {
                path: "/socket.io",
                auth: { token }, 
                transports: ["websocket"],
            });

            socket.on('connect', () => {
                console.log('WebSocket connected with ID:', socket.id);
                setIsConnected(true);
            });

            // --- THIS IS THE CRUCIAL "BOB" RESPONDER LOGIC ---
            socket.on('qkd_initiate', (payload) => {
                console.log("WebSocketContext: Received incoming QKD request from:", payload.from);

                const { session_id } = payload;
                if (!session_id) {
                    console.error("Incoming QKD request is missing a session_id. Aborting.");
                    return;
                }

                // You could trigger a UI notification here to ask for user consent
                // For now, we automatically respond.
                
                // Respond to the handshake as Bob
                respondToQKDHandshakeAsBob(payload, {
                    websocket: socket,
                    onProgress: (progress) => console.log(`[INCOMING HANDSHAKE]: ${progress}`),
                })
                .then(finalKey => {
                    console.log("SUCCESS: Securely received key from incoming handshake:", finalKey);
                    keyManager.addKey(session_id, finalKey);
                })
                .catch(err => {
                    console.error("ERROR: Incoming handshake failed:", err);
                });
            });

            socket.on('disconnect', () => {
                console.log('WebSocket disconnected.');
                setIsConnected(false);
            });
            
            socketRef.current = socket;

            return () => {
                socket.disconnect();
                socketRef.current = null;
            };
        } else if (socketRef.current) {
             socketRef.current.disconnect();
        }
    }, [isAuthenticated, user, token]);
    
    // The value provides the live socket instance. The service will use .emit() and .on() directly.
    const value = { socket: socketRef.current, isConnected };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};