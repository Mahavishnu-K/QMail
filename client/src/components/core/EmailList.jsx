/* START OF MODIFIED FILE: src/components/core/EmailList.jsx */

import React, { useRef, useEffect } from 'react';
import { PhotoIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../contexts/AuthContext';
import { InboxIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const SkeletonEmailItem = () => (
    // ... (skeleton component remains the same) ...
    <div className="p-3 animate-pulse"><div className="flex items-start space-x-3"><div className="w-8 h-8 rounded-full bg-gray-200"></div><div className="flex-1 min-w-0"><div className="h-3.5 bg-gray-200 rounded w-3/4 mb-1.5"></div><div className="h-3.5 bg-gray-200 rounded w-1/2 mb-1.5"></div><div className="h-3 bg-gray-200 rounded w-full"></div></div></div></div>
);

const EmailList = ({ 
    folder, 
    onSelectEmail, 
    selectedEmail,
    emails,
    totalEmails,
    isLoading,
    error,
    hasMore,
    isFetchingMore,
    handleRefreshEmails,
    onLoadMore
}) => {
    const scrollContainerRef = useRef(null);
    const { user } = useAuth();
    const firstName = user?.name?.split(' ')[0] || 'there';

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
            if (isNearBottom && hasMore && !isFetchingMore) onLoadMore();
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMore, isFetchingMore, onLoadMore]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex-1">{[...Array(9)].map((_, i) => <SkeletonEmailItem key={i} />)}</div>;
        }
        if (error) {
            return <div className="flex-1 flex flex-col items-center justify-center text-center p-4"><ExclamationCircleIcon className="w-10 h-10 text-red-400 mb-2" /><p className="text-red-600 font-medium">Failed to Load Emails</p><p className="text-gray-500 text-sm mt-1">{error}</p></div>;
        }
        if (emails.length === 0) {
            return <div className="flex-1 flex flex-col items-center justify-center text-center p-4"><InboxIcon className="w-10 h-10 text-gray-400 mb-2" /><p className="text-gray-600 font-medium">It's quiet in here</p><p className="text-gray-500 text-sm mt-1">No emails in your {folder} folder.</p></div>;
        }

        return (
            <ul className="flex-1 divide-y divide-gray-100">
                {emails.map((email) => {
                    // --- THE FIX ---
                    // 1. Get the raw sender name part (e.g., "Spotify").
                    const rawSender = (email.sender || 'Unknown Sender').split('<')[0].trim();
                    // 2. Use a regular expression to remove quotes from the start and end of the string.
                    const cleanedSender = rawSender.replace(/^"|"$/g, '');

                    return (
                        <li
                            key={email.id}
                            onClick={() => onSelectEmail(email)}
                            className={`p-3 cursor-pointer transition-colors duration-150 border-l-2 ${
                                selectedEmail?.id === email.id
                                    ? 'bg-blue-50 border-blue-500'
                                    : email.is_read
                                        ? 'bg-white border-transparent hover:bg-gray-50'
                                        : 'bg-blue-50 border-transparent hover:bg-blue-100 font-semibold'
                            }`}
                        >
                            <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold shrink-0 text-sm">
                                    {/* Use the cleaned sender for the initial */}
                                    {cleanedSender.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-gray-800' : 'font-medium text-gray-700'}`}>
                                            {/* Render the cleaned sender name */}
                                            {cleanedSender}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                                           {email.sent_at ? new Date(email.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <div className={`text-sm truncate mt-0.5 ${!email.is_read ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
                                        {email.subject || '(No Subject)'}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {email.snippet || ''}
                                    </p>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className="w-[360px] border-r border-gray-200 flex flex-col bg-white shrink-0">
            <div className="p-4 border-b sticky top-0 bg-white z-10 h-16 flex flex-col justify-center">
                <div className="flex justify-between items-center">
                    <h1 className="text-lg font-bold text-gray-800">
                        Hello, {firstName}
                    </h1>
                    <div className="flex gap-3 items-center relative">
                        {!isLoading && !error && (
                            <p className="text-sm text-gray-500">{totalEmails} Emails</p>
                        )}

                        <div className="relative group">
                            <ArrowPathIcon className="w-5 h-5 text-gray-500 cursor-pointer" onClick={handleRefreshEmails}/>
                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2
                                            whitespace-nowrap rounded-md bg-gray-400 text-white px-2 py-1 text-xs
                                            opacity-0 group-hover:opacity-100 transition-opacity">
                            Refresh
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                {renderContent()}
                
                {isFetchingMore && (
                    <div className="flex justify-center items-center p-4">
                        <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                )}
                {!hasMore && emails.length > 0 && (
                    <p className="text-center text-xs text-gray-400 py-4">End of conversation</p>
                )}
            </div>
        </div>
    );
};

export default EmailList;