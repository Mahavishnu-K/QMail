import React from 'react';
import { ArrowPathIcon, ShieldCheckIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

const HandshakeAnimation = ({ status, error }) => {
    if (!status) return null;

    const isError = status.toLowerCase().includes('error') || status.toLowerCase().includes('failed') || error;
    const isSuccess = status.toLowerCase().includes('established') || status.toLowerCase().includes('sent');

    const getIcon = () => {
        if (isError) return <ShieldExclamationIcon className="h-6 w-6 text-red-500" />;
        if (isSuccess) return <ShieldCheckIcon className="h-6 w-6 text-green-500" />;
        return <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-500" />;
    };

    const textColor = isError ? 'text-red-700' : isSuccess ? 'text-green-700' : 'text-blue-700';
    const bgColor = isError ? 'bg-red-50' : isSuccess ? 'bg-green-50' : 'bg-blue-50';

    return (
        <div className={`p-4 rounded-lg flex items-center transition-all duration-300 ${bgColor}`}>
            <div className="flex-shrink-0 mr-3">{getIcon()}</div>
            <div className="flex-1">
                <p className={`font-semibold text-sm ${textColor}`}>{status}</p>
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            </div>
        </div>
    );
};

export default HandshakeAnimation;