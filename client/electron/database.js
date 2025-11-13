// electron/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

let db;

const initializeDatabase = () => {
    const dbPath = path.join(app.getPath('userData'), 'emails.db');
    console.log(`Database module connecting to: ${dbPath}`); 
    db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        console.log("Setting up Database...");
        db.run(`
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
                session_id TEXT,
                imap_uid INTEGER,
                folder TEXT NOT NULL,
                sender TEXT,
                recipient TEXT,
                subject TEXT,
                snippet TEXT,
                body_plain TEXT,
                body_html TEXT,
                attachments TEXT, -- Stored as a JSON string
                sent_at TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                is_starred INTEGER DEFAULT 0,
                is_qumail_encrypted INTEGER DEFAULT 0,
                encryption_protocol TEXT
            )
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_folder_uid ON emails (folder, imap_uid);`);

        db.run(`
            CREATE TABLE IF NOT EXISTS secure_sent_cache (
                session_id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                subject TEXT,
                body TEXT,
                protocol TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });
};

const getLatestUID = (folder) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT MAX(imap_uid) as latest_uid FROM emails WHERE folder = ?", [folder], (err, row) => {
            if (err) return reject(err);
            resolve(row?.latest_uid || 0);
        });
    });
};

const getAllParkedEmails = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM secure_sent_cache", [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
};

const removeParkedEmail = (sessionId) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM secure_sent_cache WHERE session_id = ?", [sessionId], function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
        });
    });
};

const updateParkedEmailStatusInDb = (sessionId, status) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE secure_sent_cache SET status = ? WHERE session_id = ?", [status, sessionId], function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
        });
    });
};

const addToSecureSentCache = (emailData) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO secure_sent_cache (session_id, recipient, recipient_id, subject, body, protocol, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            emailData.session_id, emailData.recipient, emailData.recipientId,
            emailData.subject, emailData.body, emailData.protocol, emailData.status,
            function(err) {
                if (err) return reject(err);
                resolve({ id: this.lastID });
            }
        );
        stmt.finalize();
    });
};

const getFromSecureSentCache = (sessionId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM secure_sent_cache WHERE session_id = ?", [sessionId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

const addEmailsToCache = (emails) => {
    return new Promise((resolve, reject) => {
        if (!emails || emails.length === 0) return resolve(0);
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO emails (
                message_id, session_id, imap_uid, folder, sender, recipient, subject, snippet, 
                body_plain, body_html, attachments, sent_at, is_read, is_starred, is_qumail_encrypted, encryption_protocol
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let newRows = 0;
        db.serialize(() => {
            emails.forEach(email => {
                stmt.run(
                    email.message_id, email.session_id, email.imap_uid, email.folder, email.sender, email.recipient,
                    email.subject, email.snippet, email.body_plain, email.body_html,
                    JSON.stringify(email.attachments || []), email.sent_at,
                    email.is_read ? 1 : 0, email.is_starred ? 1 : 0,
                    email.is_qumail_encrypted ? 1 : 0,
                    email.encryption_protocol,
                    function(err) {
                        if (err) console.error("DB Insert Error:", err);
                        if (this.changes > 0) newRows++;
                    }
                );
            });
            stmt.finalize(err => {
                if (err) return reject(err);
                resolve(newRows);
            });
        });
    });
};

const getEmailDetails = (id) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM emails WHERE id = ?", [id], (err, row) => {
            if (err) return reject(err);
            if (row && row.attachments) {
                row.attachments = JSON.parse(row.attachments);
            }
            resolve(row);
        });
    });
};

const updateEmailInDb = (id, updates) => {
    return new Promise((resolve, reject) => {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        if (fields.length === 0) return resolve({ changes: 0 });
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const query = `UPDATE emails SET ${setClause} WHERE id = ?`;
        
        db.run(query, [...values, id], function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
        });
    });
};

const getEmailsFromCache = (folder, page = 1, limit = 50) => {
    // page 1 is offset 0, page 2 is offset 50, etc.
    const offset = (page - 1) * limit;

    let dataQuery;
    let countQuery;
    const queryParams = [limit, offset];
    
    if (folder === 'STARRED') {
        // For the "Starred" folder, we search for any email that is starred, regardless of its physical folder.
        dataQuery = `
            SELECT id, imap_uid, sender, recipient, subject, snippet, sent_at, is_read, is_starred 
            FROM emails WHERE is_starred = 1 ORDER BY sent_at DESC LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(id) as total FROM emails WHERE is_starred = 1`;
        // No folder parameter is needed for the query itself.
    } else {
        // This is the original, correct logic for all other physical folders.
        dataQuery = `
            SELECT id, imap_uid, sender, recipient, subject, snippet, sent_at, is_read, is_starred 
            FROM emails WHERE folder = ? ORDER BY sent_at DESC LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(id) as total FROM emails WHERE folder = ?`;
        queryParams.unshift(folder);
    }

    return new Promise((resolve, reject) => {
        const countParams = folder === 'STARRED' ? [] : [folder];
        db.get(countQuery, countParams , (err, row) => {
            if (err) return reject(err);
            const total = row.total;

            db.all(dataQuery, queryParams, (err, rows) => { 
                if (err) return reject(err);
                resolve({
                    emails: rows,
                    total,
                    hasMore: (offset + rows.length) < total,
                });
            });
        });
    });
};

const getOldestUID = (folder) => {
    return new Promise((resolve, reject) => {
        // Find the smallest (oldest) IMAP UID we have in the cache for this folder.
        db.get("SELECT MIN(imap_uid) as oldest_uid FROM emails WHERE folder = ?", [folder], (err, row) => {
            if (err) return reject(err);
            // If the folder is empty, row will be null or oldest_uid will be null.
            resolve(row?.oldest_uid || 0); 
        });
    });
};

const getEmailCountForFolder = (folder) => {
    return new Promise((resolve, reject) => {
        // Special case for 'STARRED' which is a search, not a physical folder
        const query = folder === 'STARRED'
            ? `SELECT COUNT(id) as total FROM emails WHERE is_starred = 1`
            : `SELECT COUNT(id) as total FROM emails WHERE folder = ?`;

        const params = folder === 'STARRED' ? [] : [folder];

        db.get(query, params, (err, row) => {
            if (err) return reject(err);
            resolve(row?.total || 0);
        });
    });
};

const findEmailBySessionId = (sessionId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM emails WHERE session_id = ?", [sessionId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};


module.exports = {
    initializeDatabase,
    getLatestUID,
    getOldestUID,
    updateEmailInDb,
    addEmailsToCache,
    getEmailsFromCache,
    getEmailDetails,
    findEmailBySessionId,
    getEmailCountForFolder,
    getAllParkedEmails,
    removeParkedEmail,
    updateParkedEmailStatusInDb,
    addToSecureSentCache,
    getFromSecureSentCache
};