const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setupDatabase, getEmailsFromCache, getEmailDetails, updateEmail } = require('./database');
const { startSync, updateFlags, moveMessage, backfillOldEmails } = require('./imapService');

let backfillInterval = null; 
let syncInterval; // Variable to hold our interval timer
let currentCredentials = null; 
let isSyncing = false; 
let isBackfilling = false; 

const foldersToAutoSync = ['INBOX', 'SENT'];
let autoSyncFolderIndex = 0;

const foldersToBackfill = ['INBOX', 'SENT', 'ARCHIVE', 'TRASH'];
let autoBackfillFolderIndex = 0;

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
        currentCredentials = credentials;
        
        const runSync = (folderToSync) => {
            if (isSyncing) {
                console.log("Sync requested, but a sync is already in progress. Skipping.");
                return Promise.resolve();
            }
            isSyncing = true;
            return startSync(credentials, folderToSync, {
                onProgress: (message) => win.webContents.send('sync-progress', message),
                onNewEmails: (syncedFolder) => {
                    win.webContents.send('sync-new-emails-found', syncedFolder);
                },
                onError: (errorMsg) => {
                    win.webContents.send('sync-error', errorMsg);
                    if (errorMsg.includes('Invalid credentials')) {
                        console.error("Stopping auto-sync due to invalid credentials.");
                        if (syncInterval) clearInterval(syncInterval);
                        syncInterval = null;
                    }
                },
            }).finally(() => {
                isSyncing = false;
            });
        };

        const runBackfill = (folderToBackfill) => {
            if (isBackfilling) {
                console.log("Backfill requested, but one is already in progress. Skipping.");
                return Promise.resolve();
            }
            isBackfilling = true;
            console.log(`Starting backfill for ${folderToBackfill}...`);
            return backfillOldEmails(credentials, folderToBackfill, {
                onProgress: (message) => console.log('Backfill Progress:', message),
                onNewEmails: (folder, count) => {
                    console.log(`Backfill for ${folder} completed, found ${count} older emails.`);
                    if (count === 0) {
                        if (backfillInterval) clearInterval(backfillInterval);
                        backfillInterval = null;
                        console.log('All email history has been cached. Stopping backfill timer.');
                    } else {
                        win.webContents.send('sync-new-emails-found', folder);
                    }
                },
                onError: (errorMsg) => {
                    console.error('Backfill Error:', errorMsg);
                }
            }).finally(() => {
                isBackfilling = false;
            });
        };

        runSync(folder).catch(err => console.error("Initial sync failed:", err.message));
        
        if (!syncInterval) {
            syncInterval = setInterval(() => {
                if (currentCredentials && !isSyncing) {
                    const folderToSync = foldersToAutoSync[autoSyncFolderIndex];
                    console.log(`Auto-Sync: Checking for new emails in ${folderToSync}...`);
                    runSync(folderToSync).catch(err => console.error(`Auto-sync for ${folderToSync} failed:`, err.message));
                    autoSyncFolderIndex = (autoSyncFolderIndex + 1) % foldersToAutoSync.length;
                }
            }, 120000); 
        }

        if (!backfillInterval) {
            console.log("Setting up low-priority backfill interval...");
            setTimeout(() => {
                if (currentCredentials) {
                    runBackfill('INBOX').catch(err => console.error("Initial backfill failed:", err.message));
                }
                
                backfillInterval = setInterval(() => {
                    if (currentCredentials && !isBackfilling) {
                        const folderToBackfill = foldersToBackfill[autoBackfillFolderIndex];
                        runBackfill(folderToBackfill).catch(err => console.error(`Auto-backfill for ${folderToBackfill} failed:`, err.message));
                        autoBackfillFolderIndex = (autoBackfillFolderIndex + 1) % foldersToBackfill.length;
                    }
                }, 180000);
            }, 30000);
        }
    });

    ipcMain.on('sync-folder', (event, folder) => {
        console.log(`Frontend requested sync for folder: ${folder}`);
        if (!currentCredentials || !folder) return;
        
        // This reuses the same robust runSync logic
        const runSync = (folderToSync) => {
            if (isSyncing) {
                console.log(`Sync for ${folderToSync} requested, but another sync is in progress. Skipping.`);
                return Promise.resolve();
            }
            isSyncing = true;
            return startSync(currentCredentials, folderToSync, {
                onProgress: (message) => win.webContents.send('sync-progress', message),
                onNewEmails: (syncedFolder) => win.webContents.send('sync-new-emails-found', syncedFolder),
                onError: (errorMsg) => win.webContents.send('sync-error', errorMsg),
            }).finally(() => {
                isSyncing = false;
            });
        };
        
        runSync(folder).catch(err => console.error(`On-demand sync for ${folder} failed:`, err.message));
    });

    // Triggered by the UI to get the emails currently in the cache
    ipcMain.handle('get-emails-from-cache', async (event, { folder, page }) => {
        try {
            // Pass the page number to the database function. The limit is fixed at 50.
            const result = await getEmailsFromCache(folder, page, 50);
            return result;
        } catch (error) {
            console.error("Failed to get paginated emails from cache:", error);
            return { emails: [], total: 0, hasMore: false }; 
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

            if (updates.is_starred !== undefined) {
                win.webContents.send('sync-new-emails-found', 'STARRED');
            }
            
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
    if (backfillInterval) clearInterval(backfillInterval);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});