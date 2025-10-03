const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setupDatabase, getEmailsFromCache, getEmailDetails, updateEmail } = require('./database');
const { startSync, updateFlags, moveMessage } = require('./imapService');

let syncInterval; // Variable to hold our interval timer
let currentCredentials = null; 
let isSyncing = false; 

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // In production, you'd load the built file. For dev, you load the Vite server.
    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }

    // --- IPC LISTENERS ---
    // Triggered by the UI to start a background sync
    ipcMain.on('start-email-sync', (event, { credentials, folder }) => {
        if (!credentials) return;

        // Save the latest credentials for auto-syncing
        currentCredentials = credentials;

        if (isSyncing) {
            console.log("Sync requested, but a sync is already in progress. Skipping.");
            return;
        }
        
        const runSync = (folderToSync) => {
            isSyncing = true;
            startSync(credentials, folderToSync, {
                onProgress: (message) => win.webContents.send('sync-progress', message),
                onNewEmails: (syncedFolder) => {
                    win.webContents.send('sync-new-emails-found', syncedFolder);
                    isSyncing = false; // Unlock on success
                },
                onError: (errorMsg) => {
                    win.webContents.send('sync-error', errorMsg);
                    isSyncing = false; // **CRITICAL**: Unlock on failure
                    // If credentials are bad, stop the auto-sync timer
                    if (errorMsg.includes('Invalid credentials')) {
                        console.error("Stopping auto-sync due to invalid credentials.");
                        if (syncInterval) clearInterval(syncInterval);
                        syncInterval = null;
                    }
                },
            });
        };

        runSync(folder);
        
        if (!syncInterval) {
            syncInterval = setInterval(() => {
                console.log("Auto-Sync: Checking for new emails...");
                if (currentCredentials && !isSyncing) {
                    runSync('INBOX'); 
                }
            }, 120000);
        }
    });

    // Triggered by the UI to get the emails currently in the cache
    ipcMain.handle('get-emails-from-cache', async (event, folder) => {
        try {
            const emails = await getEmailsFromCache(folder);
            return emails;
        } catch (error) {
            console.error("Failed to get emails from cache:", error);
            return [];
        }
    });

    ipcMain.handle('update-email-flags', async (event, { email, updates }) => {
        if (!currentCredentials) return { success: false, error: 'Not authenticated for action.' };
        try {
            if (updates.is_starred !== undefined) {
                await updateFlags(currentCredentials, email.folder, email.imap_uid, '\\Flagged', updates.is_starred ? 'add' : 'del');
            }
            if (updates.is_read !== undefined && updates.is_read) {
                 await updateFlags(currentCredentials, email.folder, email.imap_uid, '\\Seen', 'add');
            }

            await updateEmail(email.id, updates);
            return { success: true };
        } catch (error) {
            console.error('Failed to update email flags:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('move-email', async (event, { email, destinationFolder }) => {
        if (!currentCredentials) return { success: false, error: 'Not authenticated for action.' };
         try {
            await moveMessage(currentCredentials, email.folder, email.imap_uid, destinationFolder);
            
            await updateEmail(email.id, { folder: destinationFolder });
            
            console.log(`Successfully moved email ${email.id} to ${destinationFolder} in local DB.`);
            return { success: true };

         } catch (error) {
             console.error(`Failed to move email to ${destinationFolder}:`, error);
             return { success: false, error: error.message };
         }
    });

    ipcMain.handle('get-email-detail', async (event, emailId) => {
        return getEmailDetails(emailId);
    });
}

app.whenReady().then(() => {
    setupDatabase(); 
    createWindow();
});

app.on('will-quit', () => {
    if (syncInterval) clearInterval(syncInterval);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});