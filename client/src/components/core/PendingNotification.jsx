import React from 'react';
import { usePendingSession } from '../../contexts/PendingContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../contexts/webSocketContext';
import { XMarkIcon, ChevronDoubleRightIcon, CheckCircleIcon } from '@heroicons/react/24/solid'; 
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const PendingRequestNotification = ({ onClose }) => {
    const { 
        pendingRequests, removePendingRequest, 
        parkedEmails  
    } = usePendingSession();
    const { user } = useAuth();
    const { socket } = useWebSocket();

    const handleAccept = (request) => {
        console.log(`Bob is ACCEPTING request for session: ${request.session_id}. Nudging Alice...`);
        socket.emit('qkd_accept_pending', {
            to: request.from_id, 
            session_id: request.session_id
        });
        alert('Acceptance sent. The original sender has been notified...');
        removePendingRequest(request.session_id);
    };

    return (
        <div 
            className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-3 border-b">
                <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
            
            <div className="p-2 max-h-80 overflow-y-auto">

                {pendingRequests.length > 0 && (
                    <>
                        <h4 className="text-xs font-bold text-gray-500 px-2 pt-1 pb-2">Incoming Requests</h4>
                        {pendingRequests.map(req => (
                            <div key={req.session_id} className="p-2 rounded-md hover:bg-gray-50 flex justify-between items-center mb-1">
                            <p className="text-xs text-gray-700 flex-1 min-w-0">
                                From: <span className="font-semibold truncate">{req.from_email}</span>
                            </p>
                            <button 
                                onClick={() => handleAccept(req)}
                                title="Initiate Secure Connection"
                                className="ml-2 flex-shrink-0 text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600 flex items-center"
                            >
                                Accept <ChevronDoubleRightIcon className="w-3 h-3 ml-1"/>
                            </button>
                        </div>
                        ))}
                    </>
                )}

                {parkedEmails.length > 0 && (
                    <>
                        <h4 className="text-xs font-bold text-gray-500 px-2 pt-1 pb-2">Outgoing Pending</h4>
                        {parkedEmails.map(email => (
                            <div key={email.session_id} className="p-2 rounded-md bg-gray-50 flex justify-between items-center mb-1">
                                <p className="text-xs text-gray-700 flex-1 min-w-0">
                                    To: <span className="font-semibold truncate">{email.recipient}</span>
                                </p>
                                <div className="flex items-center text-xs text-blue-600">
                                    <ArrowPathIcon className="w-4 h-4 animate-spin mr-1"/>
                                    {/* Displays the dynamic status */}
                                    <span>{email.status === 'pending' ? 'Waiting...' : email.status}</span>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {pendingRequests.length === 0 && parkedEmails.length === 0 &&(
                    // --- IMPROVED EMPTY STATE ---
                    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                        <CheckCircleIcon className="w-12 h-12 text-green-400 mb-3" />
                        <h4 className="font-semibold text-gray-700">You're all caught up!</h4>
                        <p className="text-xs text-gray-500 mt-1">
                            We'll notify you here when new secure requests arrive.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingRequestNotification;