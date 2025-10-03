/* src/contexts/EmailContext.jsx (Final, Multi-Folder Aware Version) */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const EmailContext = createContext(null);

export const EmailProvider = ({ children }) => {
    // State to hold emails, keyed by folder name (e.g., 'INBOX', 'SENT')
    const [emails, setEmails] = useState({});
    const [syncStatus, setSyncStatus] = useState('Idle');
    const [loadingFolders, setLoadingFolders] = useState(new Set());
    const [error, setError] = useState(null);

    // This function fetches the latest emails for a SPECIFIC folder from the local cache.
    const getCachedEmails = useCallback(async (folder) => {
        // Don't try to fetch if folder is invalid
        if (!folder) return;
        try {
            console.log(`EmailContext: Requesting emails from cache for folder: ${folder}`);
            setLoadingFolders(prev => new Set(prev).add(folder));
            const cachedEmails = await window.electronAPI.getEmails(folder);
            setEmails(prev => ({ ...prev, [folder]: cachedEmails }));
        } catch (e) {
            console.error(`Failed to fetch emails for ${folder} from cache:`, e);
            setError(`Could not load emails for ${folder}.`);
        } finally {
            setLoadingFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folder);
                return newSet;
            });
        }
    }, []);

    const updateEmailInCache = useCallback((emailId, updates) => {
        setEmails(prevEmails => {
            const newEmails = { ...prevEmails };
            for (const folder in newEmails) {
                newEmails[folder] = newEmails[folder].map(email => 
                    email.id === emailId ? { ...email, ...updates } : email
                );
            }
            return newEmails;
        });
    }, []);

    const removeEmailFromCache = useCallback((emailId) => {
        setEmails(prevEmails => {
            const newEmails = { ...prevEmails };
            for (const folder in newEmails) {
                newEmails[folder] = newEmails[folder].filter(email => email.id !== emailId)
            }
            return newEmails;
        });
    }, []);

    useEffect(() => {
        if(window.electronAPI) { 
            getCachedEmails('INBOX');

            window.electronAPI.onSyncProgress(setSyncStatus);
            window.electronAPI.onSyncError(setError);
            window.electronAPI.onNewEmailsFound((syncedFolder) => {
                getCachedEmails(syncedFolder);
            });
            return () => window.electronAPI.cleanupSyncListeners();
        }
    }, [getCachedEmails]);

    const startEmailSync = useCallback((credentials, folder) => {
        if(window.electronAPI && credentials && folder){
            setError(null);
            setSyncStatus(`Initiating sync for ${folder}...`);
            window.electronAPI.startEmailSync({ credentials, folder });
        } else {
            console.warn("startEmailSync called with invalid arguments:", { credentials, folder });
        }
    },[]);

    // The value provided to all children components.
    const value = { 
        emails, 
        syncStatus, 
        error,
        loadingFolders, 
        startEmailSync, 
        getCachedEmails, 
        updateEmailInCache, 
        removeEmailFromCache 
    };

    return (
        <EmailContext.Provider value={value}>
            {children}
        </EmailContext.Provider>
    );
};

export const useEmail = () => {
    const context = useContext(EmailContext);
    if (!context) {
        throw new Error('useEmail must be used within an EmailProvider');
    }
    return context;
};