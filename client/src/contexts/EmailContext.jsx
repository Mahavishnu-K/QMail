/* src/contexts/EmailContext.jsx (Corrected and Simplified for Pagination) */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const EmailContext = createContext(null);

export const EmailProvider = ({ children }) => {
    const [emails, setEmails] = useState({});
    const [syncStatus, setSyncStatus] = useState('Idle');
    const [error, setError] = useState(null);

    // This function is the ONLY way components should add/replace data in the context.
    const setCachedEmailsForFolder = useCallback((folder, emailsData, isAppending) => {
        setEmails(prev => ({
            ...prev,
            [folder]: isAppending
                ? [...(prev[folder] || []), ...emailsData]
                : emailsData,
        }));
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

    // This effect is now much simpler. It only sets up listeners.
    useEffect(() => {
        if(window.electronAPI) { 
            window.electronAPI.onSyncProgress(setSyncStatus);
            window.electronAPI.onSyncError(setError);

            // MODIFIED: When new mail is found, we don't fetch. We set a notification state.
            // The UI component (DashboardPage) can then decide if it wants to show a "Refresh" button.
            window.electronAPI.onNewEmailsFound((syncedFolder) => {
                console.log(`EmailContext: Background sync found new mail for ${syncedFolder}. It is now in the local database.`);
            });

            return () => window.electronAPI.cleanupSyncListeners();
        }
    }, []);

    const startEmailSync = useCallback((credentials, folder) => {
        if(window.electronAPI && credentials && folder){
            setError(null);
            setSyncStatus(`Initiating sync for ${folder}...`);           
            window.electronAPI.startEmailSync({ credentials, folder });
        } else {
            console.warn("startEmailSync called with invalid arguments:", { credentials, folder });
        }
    },[]);

    const value = { 
        emails, 
        syncStatus, 
        error,
        startEmailSync, 
        setCachedEmailsForFolder, 
        updateEmailInCache, 
        removeEmailFromCache 
    };

    return (
        <EmailContext.Provider value={value}>
            {children}
        </EmailContext.Provider>
    );
};

// The custom hook to access the context.
export const useEmail = () => {
    const context = useContext(EmailContext);
    if (!context) {
        throw new Error('useEmail must be used within an EmailProvider');
    }
    return context;
};