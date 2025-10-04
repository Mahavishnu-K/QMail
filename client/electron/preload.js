/* electron/preload.js (Final, Corrected Version) */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure, well-defined API to the Renderer (React) process.
contextBridge.exposeInMainWorld('electronAPI', {

    // --- Renderer to Main Communication ---

    /**
     * Sends a request to the main process to start syncing emails for a specific folder.
     * @param {object} syncData - An object containing credentials and the folder name.
     * @param {object} syncData.credentials - The temporary credentials for IMAP.
     * @param {string} syncData.folder - The name of the folder to sync (e.g., 'INBOX').
     */
    startEmailSync: (syncData) => ipcRenderer.send('start-email-sync', syncData),

    /**
     * NEW: Triggers a one-off sync for a specific folder if it hasn't been fetched yet.
     * @param {string} folder - The name of the folder to sync (e.g., 'SENT').
     */
    syncFolder: (folder) => ipcRenderer.send('sync-folder', folder),
    
    /**
     * Asynchronously fetches a paginated list of email headers from the local cache.
     * @param {object} options - The query options.
     * @param {string} options.folder - The name of the folder.
     * @param {number} options.page - The page number to fetch.
     * @returns {Promise<Object>} A promise that resolves with { emails, total, hasMore }.
     */
    getEmails: (options) => ipcRenderer.invoke('get-emails-from-cache', options),

    /**
     * Asynchronously fetches the full details of a single email from the local cache.
     * @param {number} emailId - The local database ID of the email.
     * @returns {Promise<Object>} A promise that resolves with the full email object.
     */
    getEmailDetail: (emailId) => ipcRenderer.invoke('get-email-detail', emailId),

     // --- NEW: Real-Time Action APIs ---
    /**
     * Updates flags (like read, starred) for an email on the server and in the local cache.
     * @param {object} data - Contains email identifiers and the updates to apply.
     * @param {object} data.email - The email object with id, imap_uid, and folder.
     * @param {object} data.updates - The changes to apply (e.g., { is_read: 1, is_starred: true }).
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    updateEmailFlags: (data) => ipcRenderer.invoke('update-email-flags', data),

    /**
     * Moves an email to a different folder on the server (e.g., to TRASH or ARCHIVE).
     * @param {object} data - Contains email identifiers and the destination folder.
     * @param {object} data.email - The email object with id, imap_uid, and folder.
     * @param {string} data.destinationFolder - The target folder (e.g., 'TRASH').
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    moveEmail: (data) => ipcRenderer.invoke('move-email', data),

    // --- Main to Renderer Communication (Event Listeners) ---
    /**
     * Listens for real-time progress updates from the sync process.
     * @param {Function} callback - The function to call with the progress message.
     */
    onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (_event, message) => callback(message)),
    
    /**
     * Listens for a signal that new emails have been added to the cache for a specific folder.
     * @param {Function} callback - The function to call with the name of the synced folder.
     */
    onNewEmailsFound: (callback) => ipcRenderer.on('sync-new-emails-found', (_event, syncedFolder) => callback(syncedFolder)),
    
    /**
     * Listens for any errors that occur during the sync process.
     * @param {Function} callback - The function to call with the error message.
     */
    onSyncError: (callback) => ipcRenderer.on('sync-error', (_event, errorMessage) => callback(errorMessage)),


    // --- Cleanup ---

    /**
     * Removes all sync-related listeners to prevent memory leaks in React.
     * This should be called when the component that set them up unmounts.
     */
    cleanupSyncListeners: () => {
        ipcRenderer.removeAllListeners('sync-progress');
        ipcRenderer.removeAllListeners('sync-new-emails-found');
        ipcRenderer.removeAllListeners('sync-error');
    }
});