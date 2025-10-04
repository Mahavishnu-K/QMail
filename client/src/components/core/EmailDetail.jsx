/* src/components/specific/EmailDetail.jsx */
import React, { useEffect, useRef } from 'react';
import {
    PaperClipIcon,
    EnvelopeOpenIcon,
    TrashIcon,
    ArchiveBoxIcon,
    ArrowDownCircleIcon,
    ShieldCheckIcon, 
    ShieldExclamationIcon 
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { useDecryptedEmail } from '../../hooks/useDecryptedEmail';

import EmailBody from './EmailBody';


const EmailDetail = ({ email, folder, onUpdateEmail, onRemoveEmail, setNotification, setSelectedEmail }) => {
    
    const scrollContainerRef = useRef(null);
    const { content: bodyContent, isHtml, decryptionStatus } = useDecryptedEmail(email);
    const attachments = email?.attachments || [];

    // Effect for auto-scrolling to top and marking email as read
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
        if (email && !email.is_read) {
            window.electronAPI.updateEmailFlags({
                email: { id: email.id, imap_uid: email.imap_uid, folder: folder },
                updates: { is_read: 1 }
            }).catch(err => {
                console.error("Background task to mark as read failed:", err);
            });
        }
    }, [email, folder]);


    const handleDelete = async () => {
        if (!email) return;
        onRemoveEmail(email.id); 
        setSelectedEmail(null);
        setNotification('Moving email to Trash...');
        const result = await window.electronAPI.moveEmail({
            email: { id: email.id, imap_uid: email.imap_uid, folder: folder },
            destinationFolder: 'TRASH'
        });
        if (result.success) {
            setNotification('Email moved to Trash.');
        } else {
            setNotification(`Error: ${result.error}`);
            
        }
    };

    const handleArchive = async () => {
        if (!email) return;
        onRemoveEmail(email.id);
        setSelectedEmail(null);
        setNotification('Archiving email...');
        const result = await window.electronAPI.moveEmail({
            email: { id: email.id, imap_uid: email.imap_uid, folder: folder },
            destinationFolder: 'ARCHIVE'
        });
        if (result.success) {
            setNotification('Email archived.');
        } else {
            setNotification(`Error: ${result.error}`);
        }
    };
    
    const handleStarToggle = async () => {
        if (!email) return;
        const newStarredState = !email.is_starred;
        onUpdateEmail(email.id, { is_starred: newStarredState }); 
        
        const result = await window.electronAPI.updateEmailFlags({
            email: { id: email.id, imap_uid: email.imap_uid, folder: folder },
            updates: { is_starred: newStarredState }
        });

        if (!result.success) {
            setNotification('Error: Could not update star status.');
            onUpdateEmail(email.id, { is_starred: !newStarredState }); // Rollback on failure
        }
    };

    const handleDownload = (attachment) => {
        if (!attachment || !attachment.data) {
            setNotification('Error: Attachment data is missing.');
            console.error("Attachment data is missing or corrupt.");
            return;
        }

        try {
            // 1. Decode the Base64 string into a binary string
            const byteCharacters = atob(attachment.data);
            
            // 2. Create a byte array (Uint8Array) from the binary string
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            // 3. Create a Blob from the byte array
            const blob = new Blob([byteArray], { type: attachment.contentType || 'application/octet-stream' });
            
            // 4. Create a temporary URL for the Blob
            const url = URL.createObjectURL(blob);
            
            // 5. Create a hidden link and programmatically click it to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.filename || 'download'; // Use the attachment's filename
            document.body.appendChild(link);
            link.click();
            
            // 6. Clean up by removing the link and revoking the URL
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            setNotification('Error: Failed to process attachment for download.');
            console.error("Failed to download attachment:", error);
        }
    };

    // --- RENDER LOGIC ---

    // Display a placeholder if no email is selected
    if (!email) {
        return (
            <div className="flex-1 p-6 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <EnvelopeOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No email selected</h3>
                    <p className="mt-1 text-sm text-gray-500">Select an email from the list to read it.</p>
                </div>
            </div>
        );
    }

    if (email.isLoading) {
        return <div className="flex-1 flex items-center justify-center">Loading Content...</div>;
    }

    if (email.isError) {
        return <div className="flex-1 flex items-center justify-center text-red-500">Failed to load email content.</div>;
    }

    const rawSender = (email.sender || 'Unknown Sender').split('<')[0].trim();
    const cleanedSender = rawSender.replace(/^"|"$/g, '');
    return (
        <div className="flex-1 flex flex-col overflow-y-hidden bg-white">
            {/* Header: Controls and Metadata */}
            <div className="p-4 pb-3 border-b shrink-0">
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold text-gray-800 mb-2 flex-1">{email.subject}</h2>
                    <div className="flex items-center space-x-2 ml-4">
                        <button onClick={handleDelete} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-red-600" title="Delete"><TrashIcon className="h-5 w-5" /></button>
                        <button onClick={handleArchive} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-blue-600" title="Archive"><ArchiveBoxIcon className="h-5 w-5" /></button>
                        <button onClick={handleStarToggle} className={`p-2 rounded-full hover:bg-gray-100 ${email.is_starred ? 'text-yellow-500' : 'text-gray-500'} hover:text-yellow-500`} title="Star">
                            {email.is_starred ? <StarSolidIcon className="h-5 w-5" /> : <StarOutlineIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                    <div className="w-9 h-9 bg-gray-200 rounded-full mr-3 flex-shrink-0 flex items-center justify-center font-bold text-gray-500">
                        {cleanedSender.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate text-sm">{cleanedSender}</p>
                        <p className="truncate text-xs">To: {email.recipient}</p>
                    </div>
                    <div className="ml-auto text-xs text-gray-500 ...">{email.sent_at ? new Date(email.sent_at).toLocaleString() : 'Invalid Date'}</div>
                </div>
            </div>

            {/* NEW: Security Status Banner for Encrypted Emails */}
            {!!email.is_qumail_encrypted && (
                <div className={`p-2 text-xs text-center font-semibold flex items-center justify-center transition-colors duration-300 ${
                    decryptionStatus === 'success' ? 'bg-green-50 text-green-800' : 
                    decryptionStatus === 'error' ? 'bg-red-50 text-red-800' : 
                    'bg-blue-50 text-blue-800'
                }`}>
                    {decryptionStatus === 'success' && <ShieldCheckIcon className="h-4 w-4 mr-2" />}
                    {decryptionStatus === 'error' && <ShieldExclamationIcon className="h-4 w-4 mr-2" />}
                    
                    {
                        decryptionStatus === 'success' ? `Decrypted with ${email.encryption_protocol || 'QuMail Security'}` :
                        decryptionStatus === 'error'   ? 'Decryption Failed' :
                        'QuMail Encrypted Message'
                    }
                </div>
            )}

            {/* Body: Where the content is rendered */}
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 bg-gray-50">
                <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden">
                    {/* Render based on decryption status */}
                    {decryptionStatus === 'processing' && (
                        <div className="p-8 text-center text-gray-500">
                            <ShieldCheckIcon className="h-8 w-8 mx-auto text-blue-400 animate-pulse" />
                            <p className="mt-2 text-sm">Decrypting message...</p>
                        </div>
                    )}
                    
                    {decryptionStatus !== 'processing' && (
                       isHtml ? 
                       <EmailBody htmlContent={bodyContent} attachments={attachments} /> : 
                       <div className="p-8 whitespace-pre-wrap text-gray-800 text-sm font-mono">{bodyContent}</div>
                    )}
                </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
                <div className="p-4 pt-3 border-t shrink-0 bg-gray-50">
                    <h3 className="text-sm font-semibold mb-2 flex items-center"><PaperClipIcon className="h-4 w-4 mr-2 text-gray-500" /> Attachments ({attachments.length})</h3>
                    <ul className="space-y-2">
                        {attachments.map((attachment, index) => (
                            <li key={index} className="flex items-center justify-between p-2 bg-white rounded-md border hover:bg-gray-50 transition-colors">
                                <div className="min-w-0 pr-2">
                                    <p className="text-sm font-medium text-gray-800 truncate">{attachment.filename}</p>
                                    <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <button
                                    onClick={() => handleDownload(attachment)}
                                    className="p-1.5 text-gray-400 rounded-full hover:bg-gray-200 hover:text-blue-600 transition-colors"
                                    title={`Download ${attachment.filename}`}
                                >
                                    <ArrowDownCircleIcon className="h-5 w-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default EmailDetail;