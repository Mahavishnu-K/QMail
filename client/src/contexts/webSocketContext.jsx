import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { respondToQKDHandshakeAsBob } from '../services/qkdService'; 
import keyManager from '../services/keyManagerService';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { isAuthenticated, user, token, isLoading } = useAuth(); // We need the token for the query
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!isLoading && isAuthenticated && user && token) {
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
    }, [isLoading, isAuthenticated, user, token]);
    
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