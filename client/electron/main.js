console.log("<<<<< LOADING main.js - VERSION 2.0 >>>>>");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { initializeDatabase, getEmailsFromCache, getEmailDetails, updateEmailInDb, findEmailBySessionId, addToSecureSentCache, getAllParkedEmails, removeParkedEmail, updateParkedEmailStatusInDb, getFromSecureSentCache } = require('./database');
const { startSync, updateFlags, moveMessage, backfillOldEmails } = require('./imapService');

let backfillInterval = null; 
let syncInterval; 
let currentCredentials = null; 
let isSyncing = false; 
let isBackfilling = false; 

let mainWindow = null;
let tray = null;
app.isQuitting = false;


const foldersToAutoSync = ['INBOX', 'SENT'];
let autoSyncFolderIndex = 0;

const foldersToBackfill = ['INBOX', 'SENT', 'ARCHIVE', 'TRASH'];
let autoBackfillFolderIndex = 0;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance. We should focus our main window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });
}

if (!app.isPackaged) {
  const portArg = process.argv.find(arg => arg.startsWith('--dev-port='));
  const port = portArg ? portArg.split('=')[1] : '5173';
  const defaultUserDataPath = app.getPath('userData');
  const newUserDataPath = `${defaultUserDataPath}-dev-${port}`;
  app.setPath('userData', newUserDataPath);
  console.log(`Setting userData path to: ${newUserDataPath}`);
}

function createWindow() {

    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        return;
    }

    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: icon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    const portArg = process.argv.find(arg => arg.startsWith('--dev-port='));
    const port = portArg ? portArg.split('=')[1] : '5173';
    const devUrl = `http://localhost:${port}`;

    // In production, you'd load the built file. For dev, you load the Vite server.
    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show QMail', click: () => createWindow() },
        { type: 'separator' },
        {
            label: 'Quit QMail',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('QMail is running securely in the background.');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => createWindow());
}

app.whenReady().then(() => {
    initializeDatabase();
    createTray();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (syncInterval) clearInterval(syncInterval);
    if (backfillInterval) clearInterval(backfillInterval);
});

app.on('window-all-closed', () => {
    
    if (process.platform !== 'darwin') {
        if (!app.isQuitting) {
            // Do nothing, keep the app running.
        }
    }
});

// --- IPC LISTENERS ---
// Triggered by the UI to start a background sync
ipcMain.on('start-email-sync', (event, { credentials, folder }) => {
    if (!credentials) return;
    currentCredentials = credentials;
    const win = mainWindow || BrowserWindow.getAllWindows()[0];
    
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
    const win = mainWindow || BrowserWindow.getAllWindows()[0];

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

        await updateEmailInDb(email.id, updates);

        if (updates.is_starred !== undefined) {
            const win = mainWindow || BrowserWindow.getAllWindows()[0];
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
        
        await updateEmailInDb(email.id, { folder: destinationFolder });
        
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

ipcMain.handle('find-email-by-session-id', async (event, sessionId) => {
    return findEmailBySessionId(sessionId);
});

ipcMain.handle('update-email-in-db', async (event, { id, updates }) => {
    
    console.log("\n\n\n!!!!!!!!!!!!!!!!! MAIN PROCESS IPC HANDLER FIRING !!!!!!!!!!!!!!!!\n\n\n");
    console.log(`>>>> MAIN PROCESS RECEIVED UPDATE FOR ID ${id}:`, updates);

    const result = await updateEmailInDb(id, updates);
    if (result.changes > 0) {
        const win = mainWindow || BrowserWindow.getAllWindows()[0];
        console.log(`Main Process: Notifying renderer that email ${id} was updated.`);
        // 'win' is the reference to your BrowserWindow
        win.webContents.send('email-decrypted-and-updated', { emailId: id });
    }
    return result;
});

ipcMain.handle('get-all-parked-emails', async () => {
    return getAllParkedEmails();
});

ipcMain.handle('remove-parked-email', async (event, sessionId) => {
    return removeParkedEmail(sessionId);
});

ipcMain.handle('update-parked-email-status', (event, { sessionId, status }) => {
    return updateParkedEmailStatusInDb(sessionId, status);
});

ipcMain.handle('add-to-secure-sent-cache', async (event, emailData) => {
    return addToSecureSentCache(emailData);
});

ipcMain.handle('get-from-secure-sent-cache', (event, sessionId) => {
    return getFromSecureSentCache(sessionId);
});