// electron/imapService.js (Final Feature-Rich Version)

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const base64 = require('base-64');
const { addEmailsToCache, getLatestUID, getOldestUID, getEmailCountForFolder } = require('./database');

const GMAIL_FOLDER_MAP = {
    'INBOX': 'INBOX',
    'SENT': '[Gmail]/Sent Mail',
    'TRASH': '[Gmail]/Trash',
    'SPAM': '[Gmail]/Spam', 
    'DRAFTS': '[Gmail]/Drafts',
    'ARCHIVE': '[Gmail]/All Mail',
    'STARRED': '[Gmail]/All Mail', // Starred is a search, not a folder
    'IMPORTANT': '[Gmail]/All Mail' // Important is a search
};

const GMAIL_SEARCH_MAP = {
    'STARRED': ['FLAGGED'],
    'IMPORTANT': ['X-GM-LABELS','\\Important']
};

const parseEmail = (rawEmail, seqno, folderName, userEmail, message_flags = []) => {
    return new Promise((resolve) => {
        simpleParser(rawEmail, (err, parsed) => {
            if (err) return resolve(null);

            const isSentFolder = folderName === 'SENT';
            const attachments = (parsed.attachments || []).map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                data: att.content.toString('base64'),
                contentId: att.cid
            }));

            resolve({
                message_id: parsed.messageId,
                imap_uid: seqno,
                folder: folderName,
                sender: isSentFolder ? userEmail : (parsed.from?.text || 'Unknown'),
                recipient: isSentFolder ? (parsed.to?.text || 'Unknown') : userEmail,
                subject: parsed.subject || '(No Subject)',
                snippet: (parsed.text || '').substring(0, 150).replace(/\s+/g, ' '),
                body_plain: parsed.text,
                body_html: parsed.html || parsed.textAsHtml,
                attachments: attachments,
                sent_at: parsed.date?.toISOString() || new Date().toISOString(),
                is_read: message_flags.includes('\\Seen') || false,
                is_starred: message_flags.includes('\\Flagged') || false,
            });
        });
    });
};


const startSync = async (credentials, folderName, { onProgress, onNewEmails, onError }) => {
    return new Promise((resolve, reject) => {
        try {
            const authString = `user=${credentials.email}\x01auth=Bearer ${credentials.accessToken}\x01\x01`;
            const xoauth2_token = base64.encode(authString); 

            const imapConfig = {
                user: credentials.email,
                xoauth2: xoauth2_token,
                host: credentials.imapServer,
                port: 993,
                tls: true,
                // **THE FIX**: This option tells the underlying TLS module
                // to not fail if it encounters a self-signed certificate, which
                // is common in corporate/proxied network environments.
                tlsOptions: { 
                    rejectUnauthorized: false 
                }
            };
            
            const imap = new Imap(imapConfig);

            const handleError = (err) => {
                const errorMsg = err.message || 'An unknown IMAP error occurred.';
                console.error(`IMAP Error for ${folderName}:`, errorMsg);
                onError(errorMsg);
                reject(err);
                // Ensure connection is terminated
                try { imap.end(); } catch (e) {}
            };

            imap.once('ready', () => {
                onProgress(`Authenticated. Opening folder: ${folderName}...`);
                const physicalFolder = GMAIL_FOLDER_MAP[folderName] || folderName;

                imap.openBox(physicalFolder, true, async (err, box) => {
                    if (err) return handleError(new Error(`Could not open folder "${folderName}".`));
                    
                    try {
                        const latestUID = await getLatestUID(folderName);
                        
                        let searchCriteria;
                        const specialSearchTerm = GMAIL_SEARCH_MAP[folderName];

                        if (specialSearchTerm) { 
                            onProgress(`Searching for '${folderName}' messages...`);
                            searchCriteria = specialSearchTerm;
                        } else { 
                            searchCriteria = ['ALL'];
                            if (latestUID > 0 && box.uidnext > latestUID + 1) {
                                onProgress(`Fetching new messages for ${folderName}...`);
                                searchCriteria.push(['UID', `${latestUID + 1}:*`]);
                            } else if (latestUID === 0) {
                                onProgress(`Performing initial fetch for ${folderName}...`);
                            } else {
                                onProgress(`Sync complete for ${folderName}. No new messages.`);
                                resolve();
                                return imap.end();
                            }
                        }
                        
                        imap.search(searchCriteria, (err, uids) => {
                            if (err) return handleError(err);
                            if (!uids || uids.length === 0) {
                                onProgress(`Sync complete for ${folderName}. No results found.`);
                                resolve();
                                return imap.end();
                            }
                            
                            const uidsToFetch = uids.slice(-50); 
                            if (uidsToFetch.length === 0) {
                                onProgress(`Sync complete for ${folderName}. No results to fetch.`);
                                resolve();
                                return imap.end();
                            }
                            const f = imap.fetch(uidsToFetch, { bodies: '', flags: true });
                            const emailPromises = [];

                            f.on('message', (msg, seqno) => {
                                let raw_email = '';
                                let message_flags = [];
                                msg.once('attributes', (attrs) => { message_flags = attrs.flags || []; });
                                msg.on('body', (stream) => stream.on('data', (c) => raw_email += c.toString('utf8')));
                                msg.once('end', () => emailPromises.push(parseEmail(raw_email, seqno, folderName, credentials.email, message_flags)));
                            });
                            f.once('error', handleError);
                            f.once('end', async () => {
                                const emailsToCache = (await Promise.all(emailPromises)).filter(Boolean);
                                if (emailsToCache.length > 0) {
                                    const newRowCount = await addEmailsToCache(emailsToCache);
                                    if (newRowCount > 0) onNewEmails(folderName);
                                }
                                onProgress(`Sync complete for ${folderName}.`);
                                resolve();
                                imap.end();
                            });
                        });
                    } catch (e) {
                        handleError(e);
                    }
                });
            });

            imap.once('error', handleError);
            imap.connect();
        } catch (error) {
            onError(error.message);
            reject(error);
        }
    });
};

const performAction = (credentials, actionCallback) => {
    return new Promise((resolve, reject) => {
        const authString = `user=${credentials.email}\x01auth=Bearer ${credentials.accessToken}\x01\x01`;
        const xoauth2_token = base64.encode(authString);
        const imap = new Imap({
            user: credentials.email, xoauth2: xoauth2_token, host: credentials.imapServer, port: 993, tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        imap.once('ready', () => actionCallback(imap, resolve, reject));
        imap.once('error', reject);
        imap.connect();
    });
};

// --- NEW: Function to update flags on the server ---
const updateFlags = (credentials, folder, uid, flags, operation) => {
    const physicalFolder = GMAIL_FOLDER_MAP[folder] || folder;
    return performAction(credentials, (imap, resolve, reject) => {
        imap.openBox(physicalFolder, false, (err) => {
            if (err) return reject(new Error(`Could not open folder ${folder} to update flags.`));
            const flagFn = operation === 'add' ? imap.addFlags.bind(imap) : imap.delFlags.bind(imap);
            flagFn(uid, flags, (err) => {
                if (err) return reject(new Error(`Failed to ${operation} flags.`));
                imap.end();
                resolve();
            });
        });
    });
};

// --- NEW: Function to move a message on the server ---
const moveMessage = (credentials, folder, uid, destination) => {
    const physicalFolder = GMAIL_FOLDER_MAP[folder] || folder;
    const physicalDestination = GMAIL_FOLDER_MAP[destination] || destination;
    if (!physicalDestination) return Promise.reject(new Error(`Unknown destination folder: ${destination}`));

    return performAction(credentials, (imap, resolve, reject) => {
         imap.openBox(physicalFolder, false, (err) => {
            if (err) return reject(new Error(`Could not open source folder ${folder}.`));
            imap.move(uid, physicalDestination, (err) => {
                 if (err) return reject(new Error(`Failed to move message to ${destination}.`));
                 imap.end();
                 resolve();
            });
         });
    });
};

const backfillOldEmails = async (credentials, folderName, { onProgress, onNewEmails, onError }) => {
    return new Promise(async (resolve, reject) => { 
        try {

            const emailCount = await getEmailCountForFolder(folderName);
            const BACKFILL_LIMIT = 1700;

            if (emailCount >= BACKFILL_LIMIT) {
                onProgress(`Backfill for ${folderName} skipped: Local cache limit of ${BACKFILL_LIMIT} reached (${emailCount} emails).`);
                
                if (onNewEmails) onNewEmails(folderName, 0); 
                
                return resolve();
            }

            const oldestUID = await getOldestUID(folderName);
            
            // If there are no emails in the cache for this folder, there's nothing to backfill from.
            // The regular `startSync` will handle the initial population.
            if (!oldestUID || oldestUID <= 1) {
                onProgress(`Backfill for ${folderName}: No older emails to fetch.`);
                if (onNewEmails) onNewEmails(folderName, 0); 
                return resolve();
            }

            const authString = `user=${credentials.email}\x01auth=Bearer ${credentials.accessToken}\x01\x01`;
            const xoauth2_token = base64.encode(authString);
            const imap = new Imap({
                user: credentials.email, xoauth2: xoauth2_token, host: credentials.imapServer, port: 993, tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });

            const handleError = (err) => {
                const errorMsg = err.message || 'An unknown IMAP error occurred.';
                console.error(`IMAP Error for ${folderName}:`, errorMsg);
                onError(errorMsg);
                reject(err);
                try { imap.end(); } catch (e) {}
            };

            imap.once('ready', () => {
                onProgress(`Backfilling old emails for: ${folderName}...`);
                const physicalFolder = GMAIL_FOLDER_MAP[folderName] || folderName;

                imap.openBox(physicalFolder, true, (err, box) => {
                    if (err) return handleError(err);
                    
                    // Search for all emails with a UID from 1 up to (but not including) our oldest one.
                    const searchCriteria = [['UID', `1:${oldestUID - 1}`]];

                    imap.search(searchCriteria, (err, uids) => {
                        if (err) return handleError(err);
                        if (!uids || uids.length === 0) {
                            onProgress(`Backfill complete for ${folderName}. All history is cached.`);
                            if (onNewEmails) onNewEmails(folderName, 0);
                            imap.end();
                            return resolve();
                        }

                        const uidsToFetch = uids.slice(-50);
                        const f = imap.fetch(uidsToFetch, { bodies: '', flags: true });
                        const emailPromises = [];

                        f.on('message', (msg, seqno) => {
                            let raw_email = '';
                            let message_flags = [];
                            msg.once('attributes', (attrs) => { message_flags = attrs.flags || []; });
                            msg.on('body', (stream) => stream.on('data', (c) => raw_email += c.toString('utf8')));
                            msg.once('end', () => emailPromises.push(parseEmail(raw_email, seqno, folderName, credentials.email, message_flags)));
                        });
                        f.once('error', handleError);
                        f.once('end', async () => {
                            const emailsToCache = (await Promise.all(emailPromises)).filter(Boolean);
                            if (emailsToCache.length > 0) {
                                const newRowCount = await addEmailsToCache(emailsToCache);
                                onProgress(`Backfilled and cached ${newRowCount} older emails for ${folderName}.`);
                                if (onNewEmails) onNewEmails(folderName, newRowCount);
                            } else {
                                if (onNewEmails) onNewEmails(folderName, 0);
                            }
                            imap.end();
                            resolve();
                        });
                    });
                });
            });
            imap.once('error', handleError);
            imap.connect();
        } catch (error) {
            onError(error.message);
            reject(error);
        }
    });
};

module.exports = { startSync, updateFlags, moveMessage, backfillOldEmails };