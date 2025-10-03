// electron/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'emails.db');
const db = new sqlite3.Database(dbPath);

const setupDatabase = () => {
    db.serialize(() => {
        console.log("Setting up Database...");
        db.run(`
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
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

const addEmailsToCache = (emails) => {
    return new Promise((resolve, reject) => {
        if (!emails || emails.length === 0) return resolve(0);
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO emails (
                message_id, imap_uid, folder, sender, recipient, subject, snippet, 
                body_plain, body_html, attachments, sent_at, is_read, is_starred
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let newRows = 0;
        db.serialize(() => {
            emails.forEach(email => {
                stmt.run(
                    email.message_id, email.imap_uid, email.folder, email.sender, email.recipient,
                    email.subject, email.snippet, email.body_plain, email.body_html,
                    JSON.stringify(email.attachments || []), email.sent_at,
                    email.is_read ? 1 : 0, email.is_starred ? 1 : 0,
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


const getEmailsFromCache = (folder) => {
    // Only select the fields needed for the list view for performance
    const query = `
        SELECT id, imap_uid, sender, recipient, subject, snippet, sent_at, is_read, is_starred 
        FROM emails WHERE folder = ? ORDER BY sent_at DESC LIMIT 100
    `;
    return new Promise((resolve, reject) => {
        db.all(query, [folder], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

const updateEmail = (id, updates) => {
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

module.exports = {
    setupDatabase,
    getLatestUID,
    updateEmail,
    addEmailsToCache,
    getEmailsFromCache,
    getEmailDetails
};