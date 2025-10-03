/* This file should exist at src/components/ui/Notification.jsx */

import React, { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const Notification = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000); // Auto-close after 5 seconds

            return () => clearTimeout(timer);
        }
    }, [message, onClose]);
    
    if (!message) return null;

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-500' : 'bg-red-500';
    const iconColor = isSuccess ? 'text-green-100' : 'text-red-100';
    const Icon = isSuccess ? CheckCircleIcon : XCircleIcon;

    return (
        <div 
            className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center animate-slide-in-fade-in z-50`}
        >
            <Icon className={`h-6 w-6 mr-3 ${iconColor}`} />
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 font-bold text-white/70 hover:text-white">✕</button>
        </div>
    );
};

export default Notification;