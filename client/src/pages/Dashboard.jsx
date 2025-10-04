/* src/pages/DashboardPage.jsx (Final, Corrected Version) */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useEmail } from '../contexts/EmailContext';

import Header from '../components/core/Header';
import EmailList from '../components/core/EmailList';
import EmailDetail from '../components/core/EmailDetail';
import { LinkIcon } from '@heroicons/react/24/outline'; 

import { apiClient } from '../services/api';

const DashboardPage = () => {
    // --- Router and Context Hooks ---
    const { folderId = 'inbox' } = useParams();
    const { setNotification } = useOutletContext();
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        emails,
        error,
        setCachedEmailsForFolder,
        startEmailSync,
        updateEmailInCache,
        removeEmailFromCache
    } = useEmail();

    // --- Component State ---
    const [selectedEmail, setSelectedEmail] = useState(null); 
    const [activeAccount, setActiveAccount] = useState(null);
    const [view, setView] = useState('loading'); 
    const initialSyncTriggered = useRef(false);
    const [syncedFolders, setSyncedFolders] = useState(new Set());

    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [totalEmails, setTotalEmails] = useState(0);

    // --- Derived State ---
    const currentFolder = folderId.toUpperCase();
    const currentEmails = emails[currentFolder] || [];

    // --- Data Fetching Logic ---
    const fetchEmailsByPage = useCallback(async (folder, page) => {
        if (isFetching) return;
        setIsFetching(true);
        try {
            const response = await window.electronAPI.getEmails({ folder, page });
            // Always replace the list with the new page's data
            setCachedEmailsForFolder(folder, response.emails, false);
            setTotalEmails(response.total);
            setHasMore(response.hasMore);
            setCurrentPage(page);
        } catch (err) {
            console.error(`Failed to fetch emails for ${folder}:`, err);
            setNotification(`Error: Could not load emails for ${folder}.`);
        } finally {
            setIsFetching(false);
        }
    }, [isFetching, setCachedEmailsForFolder, setNotification]);

    // --- Effects ---

    // Effect for when the user navigates to a new folder
     useEffect(() => {
        setSelectedEmail(null);
        fetchEmailsByPage(currentFolder, 1);

        // NEW: Trigger sync if this folder hasn't been synced in this session
        if (activeAccount && !syncedFolders.has(currentFolder)) {
            console.log(`Triggering first-time sync for folder: ${currentFolder}`);
            window.electronAPI.syncFolder(currentFolder);
            setSyncedFolders(prev => new Set(prev).add(currentFolder));
        }
    }, [folderId, activeAccount]);

    // Effect for the one-time initial setup on component mount
    useEffect(() => {
        if (initialSyncTriggered.current || !user) {
            return;
        }

        const fetchCredentialsAndStartSync = async () => {
            setView('loading');
            try {
                const accountsResponse = await apiClient.get('/accounts/linked');
                if (accountsResponse.data?.length > 0) {
                    const primaryAccount = accountsResponse.data[0];
                    setActiveAccount(primaryAccount);
                    const credsResponse = await apiClient.get(`/accounts/${primaryAccount.id}/sync-credentials`);
                    if (credsResponse.data && credsResponse.data.accessToken) {
                        startEmailSync(credsResponse.data, 'INBOX');
                        setSyncedFolders(prev => new Set(prev).add('INBOX'));
                        setView('email');
                        initialSyncTriggered.current = true; 
                    } else { throw new Error("Received invalid sync credentials."); }
                } else {
                    setNotification("Welcome! Please link an account in Settings.");
                    setView('welcome');
                }
            } catch (err) {
                console.error("Failed to start initial sync:", err);
                setNotification("Error: Could not start email sync.");
                setView('error');
            }
        };
        fetchCredentialsAndStartSync();
    }, [user, startEmailSync, setNotification]);

    useEffect(() => {
        const handleBackgroundUpdate = (syncedFolder) => {
            // If the folder that was updated in the background is the one we are currently viewing...
            if (syncedFolder.toUpperCase() === currentFolder) {
                console.log(`Background update detected for ${syncedFolder}. Refreshing current view.`);
                // Re-fetch the current page to get the updated total count and any new items.
                fetchEmailsByPage(currentFolder, currentPage);
            }
        };

        window.electronAPI.onNewEmailsFound(handleBackgroundUpdate);

        // Cleanup the listener when the component unmounts
        return () => {
            window.electronAPI.cleanupSyncListeners(); 
        };
    }, [currentFolder, currentPage, fetchEmailsByPage]);

    // --- Event Handlers ---
    const handleNextPage = () => {
        if (hasMore && !isFetching) {
            fetchEmailsByPage(currentFolder, currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1 && !isFetching) {
            fetchEmailsByPage(currentFolder, currentPage - 1);
        }
    };

    const handleRefreshEmails = useCallback(async () => {
        if (!activeAccount || isFetching) return;
        setNotification(`Checking for new mail in ${currentFolder}...`);
        try {
            const credsResponse = await apiClient.get(`/accounts/${activeAccount.id}/sync-credentials`);
            startEmailSync(credsResponse.data, currentFolder);
            setTimeout(() => {
                fetchEmailsByPage(currentFolder, 1); 
                setNotification(`${currentFolder} is up to date.`);
            }, 1500);
        } catch (err) {
            setNotification('Error: Failed to refresh emails.');
        }
    }, [activeAccount, isFetching, currentFolder, startEmailSync, fetchEmailsByPage, setNotification]);

    const handleUpdateEmail = useCallback((emailId, updates) => {
        if (selectedEmail && selectedEmail.id === emailId) {
            setSelectedEmail(prev => ({ ...prev, ...updates }));
        }
        updateEmailInCache(emailId, updates);
    }, [selectedEmail, updateEmailInCache]);

    const handleRemoveEmail = useCallback((emailId) => {
        setSelectedEmail(null);
        removeEmailFromCache(emailId);
    }, [removeEmailFromCache]);

    const handleSelectEmail = useCallback(async (emailHeader) => {
        if (emailHeader.id === selectedEmail?.id) return;
           setSelectedEmail({ ...emailHeader, isLoading: true });
        try {
            const fullEmail = await window.electronAPI.getEmailDetail(emailHeader.id);
            if (!fullEmail) throw new Error("Email content not found in cache.");
            setSelectedEmail(fullEmail);
            if (!fullEmail.is_read) {
                updateEmailInCache(fullEmail.id, { is_read: 1 });
            }
        } catch (err) { 
            console.error("Failed to load email detail:", err);
            setNotification("Error: Could not load email content.");
            setSelectedEmail({ ...emailHeader, isError: true });
        }
    }, [selectedEmail, updateEmailInCache, setNotification]);
    
    // --- Render Logic ---
    if (view === 'loading') {
        return <div className="flex-1 flex items-center justify-center">Loading Dashboard...</div>;
    }

    if (view === 'welcome') {
        return (
            <div className="flex-1 flex items-center justify-center text-center bg-gray-50">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Welcome to QuMail!</h2>
                    <p className="mt-2 text-gray-600">Please link a mailbox in Settings to get started.</p>
                    <button 
                        onClick={() => navigate('/settings')}
                        className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                        <LinkIcon className="-ml-1 mr-2 h-5 w-5" />
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'error') {
         return (
            <div className="flex-1 flex items-center justify-center text-center bg-red-50 text-red-700">
                <div>
                    <h2 className="text-2xl font-bold">An Error Occurred</h2>
                    <p className="mt-2">Could not load your account data. Please try again later.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-1 overflow-hidden">
            <EmailList 
                folder={currentFolder}
                emails={currentEmails}
                error={error}
                totalEmails={totalEmails}
                isLoading={isFetching}
                currentPage={currentPage}
                hasMore={hasMore}
                onNextPage={handleNextPage}
                onPrevPage={handlePrevPage}
                selectedEmail={selectedEmail}
                onSelectEmail={handleSelectEmail}
                handleRefreshEmails={handleRefreshEmails}
            />
            <div className="flex-1 flex flex-col bg-gray-50">
                <Header />
                <EmailDetail 
                    email={selectedEmail} 
                    folder={currentFolder}
                    onUpdateEmail={handleUpdateEmail}
                    onRemoveEmail={handleRemoveEmail}
                    setNotification={setNotification}
                    setSelectedEmail={setSelectedEmail}
                />
            </div>
        </div>
    );
};

export default DashboardPage;