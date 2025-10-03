/* src/pages/DashboardPage.jsx */
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
    // --- Local UI State ---
    const [selectedEmail, setSelectedEmail] = useState(null); 
    const [activeAccount, setActiveAccount] = useState(null);
    const [view, setView] = useState('loading'); 
    const { folderId = 'inbox' } = useParams();
    const { setNotification } = useOutletContext();
    const initialSyncTriggered = useRef(false);
    const loadedFoldersSync = useRef(new Set());

    const navigate = useNavigate();

    // --- Global State from Contexts ---
    const { user } = useAuth();
    const { 
        emails, syncStatus, error, loadingFolders, startEmailSync,
        updateEmailInCache, removeEmailFromCache 
    } = useEmail();

    const currentFolder = folderId.toUpperCase();
    const currentEmails = emails[currentFolder] || [];
    const isFoldersLoading = loadingFolders.has(currentFolder);

    // This effect runs once to load accounts and trigger the very first sync for INBOX
    useEffect(() => {
        if (!user || initialSyncTriggered.current) {
            return;
        }
        
        initialSyncTriggered.current = true; 
            
        const fetchCredentialsAndStartSync = async () => {
            try {
                const accountsResponse = await apiClient.get('/accounts/linked');
                if (accountsResponse.data?.length > 0) {
                    const primaryAccount = accountsResponse.data[0];
                    setActiveAccount(primaryAccount);
                        
                    const credsResponse = await apiClient.get(`/accounts/${primaryAccount.id}/sync-credentials`);
                    
                    // **THE FIX**: Ensure the credentials object is valid before syncing.
                    if (credsResponse.data && credsResponse.data.accessToken) {
                        startEmailSync(credsResponse.data, 'INBOX');
                        setView('email');
                    } else {
                        throw new Error("Received invalid sync credentials from server.");
                    }
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
        const currentFolder = folderId.toUpperCase();
        if (activeAccount && !loadedFoldersSync.current.has(currentFolder)) {
            const syncNewFolder = async () => {
                try {
                    const credsResponse = await apiClient.get(`/accounts/${activeAccount.id}/sync-credentials`);
                    startEmailSync(credsResponse.data, currentFolder);
                    loadedFoldersSync.current.add(currentFolder);
                } catch (err) {
                    console.error(`Failed to sync folder ${currentFolder}:`, err);
                    setNotification(`Error: Could not sync ${currentFolder}.`);
                }
            };
            syncNewFolder();
        }
    }, [folderId, activeAccount, startEmailSync]);


    const handleRefreshEmails = useCallback(async () => {
        const currentFolder = folderId.toUpperCase();
        if (!activeAccount) return;
        try {
            setNotification(`Refreshing ${currentFolder}...`);
            const credsResponse = await apiClient.get(`/accounts/${activeAccount.id}/sync-credentials`);
            startEmailSync(credsResponse.data, currentFolder);
        } catch (err) {
            setNotification('Error: Failed to refresh emails.');
        }
    }, [activeAccount, folderId, startEmailSync, setNotification]);

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
                isLoading={isFoldersLoading} 
                error={error}
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
                />
            </div>
        </div>
    );
};

export default DashboardPage;