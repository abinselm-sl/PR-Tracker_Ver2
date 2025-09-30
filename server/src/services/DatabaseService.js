const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  initialize() {
    const dbPath = path.join(__dirname, '../../data/logistics.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    const tables = [
      // Users and sessions
      `CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        device_id TEXT,
        device_name TEXT,
        last_seen INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,

      // Purchase Requisitions
      `CREATE TABLE IF NOT EXISTS purchase_requisitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        status TEXT NOT NULL,
        requisition_by TEXT,
        approved_by TEXT,
        last_modified_by TEXT,
        last_modified_timestamp INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,

      // PR Items
      `CREATE TABLE IF NOT EXISTS pr_items (
        id TEXT PRIMARY KEY,
        pr_id TEXT NOT NULL,
        description TEXT NOT NULL,
        original_quantity INTEGER NOT NULL,
        received_quantity INTEGER DEFAULT 0,
        comment TEXT DEFAULT '',
        is_complete INTEGER DEFAULT 0,
        last_modified_by TEXT,
        last_modified_timestamp INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (pr_id) REFERENCES purchase_requisitions (id) ON DELETE CASCADE
      )`,

      // Change log for sync
      `CREATE TABLE IF NOT EXISTS change_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        change_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT NOT NULL,
        username TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )`,

      // Sync status tracking
      `CREATE TABLE IF NOT EXISTS sync_status (
        device_id TEXT PRIMARY KEY,
        last_sync_timestamp INTEGER DEFAULT 0
      )`
    ];

    tables.forEach(sql => {
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
        }
      });
    });
  }

  // User session methods
  createUserSession(session) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR REPLACE INTO user_sessions 
                   (session_id, username, role, device_id, device_name, last_seen) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      
      this.db.run(sql, [
        session.sessionId,
        session.username,
        session.role,
        session.deviceId,
        session.deviceName,
        session.lastSeen
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  getUserSession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_sessions WHERE session_id = ?';
      this.db.get(sql, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  deleteUserSession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM user_sessions WHERE session_id = ?';
      this.db.run(sql, [sessionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  updateUserHeartbeat(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE user_sessions SET last_seen = ? WHERE session_id = ?';
      this.db.run(sql, [Date.now(), sessionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  getActiveSessions() {
    return new Promise((resolve, reject) => {
      const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
      const sql = 'SELECT * FROM user_sessions WHERE last_seen > ? ORDER BY last_seen DESC';
      this.db.all(sql, [cutoff], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Purchase Requisition methods
  getAllPRs() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM purchase_requisitions ORDER BY created_at DESC';
      this.db.all(sql, [], async (err, rows) => {
        if (err) {
          reject(err);
        } else {
          try {
            const prs = await Promise.all(rows.map(async (row) => {
              const items = await this.getPRItems(row.id);
              return {
                ...row,
                items,
                lastModifiedBy: row.last_modified_by ? {
                  userName: row.last_modified_by,
                  timestamp: row.last_modified_timestamp
                } : undefined
              };
            }));
            resolve(prs);
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  }

  getPRItems(prId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM pr_items WHERE pr_id = ? ORDER BY created_at';
      this.db.all(sql, [prId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const items = rows.map(row => ({
            ...row,
            isComplete: row.is_complete === 1,
            lastModifiedBy: row.last_modified_by ? {
              userName: row.last_modified_by,
              timestamp: row.last_modified_timestamp
            } : undefined
          }));
          resolve(items);
        }
      });
    });
  }

  createPR(pr) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Insert PR
        const prSql = `INSERT INTO purchase_requisitions 
                       (id, name, issue_date, status, requisition_by, approved_by, last_modified_by, last_modified_timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        
        this.db.run(prSql, [
          pr.id,
          pr.name,
          pr.issueDate,
          pr.status,
          pr.requisitionBy,
          pr.approvedBy,
          pr.lastModifiedBy?.userName,
          pr.lastModifiedBy?.timestamp
        ], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }

          // Insert items
          const itemSql = `INSERT INTO pr_items 
                           (id, pr_id, description, original_quantity, received_quantity, comment, is_complete, last_modified_by, last_modified_timestamp)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          let itemsProcessed = 0;
          const totalItems = pr.items.length;

          if (totalItems === 0) {
            this.db.run('COMMIT');
            resolve(pr);
            return;
          }

          pr.items.forEach(item => {
            this.db.run(itemSql, [
              item.id,
              pr.id,
              item.description,
              item.originalQuantity,
              item.receivedQuantity,
              item.comment,
              item.isComplete ? 1 : 0,
              item.lastModifiedBy?.userName,
              item.lastModifiedBy?.timestamp
            ], (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }

              itemsProcessed++;
              if (itemsProcessed === totalItems) {
                this.db.run('COMMIT');
                this.logChange('create', 'pr', pr.id, pr, pr.lastModifiedBy?.userName);
                resolve(pr);
              }
            });
          });
        });
      });
    });
  }

  updatePRItem(prId, itemId, updates, username) {
    return new Promise((resolve, reject) => {
      const setClause = [];
      const values = [];

      if (updates.receivedQuantity !== undefined) {
        setClause.push('received_quantity = ?');
        values.push(updates.receivedQuantity);
      }

      if (updates.comment !== undefined) {
        setClause.push('comment = ?');
        values.push(updates.comment);
      }

      if (updates.isComplete !== undefined) {
        setClause.push('is_complete = ?');
        values.push(updates.isComplete ? 1 : 0);
      }

      setClause.push('last_modified_by = ?', 'last_modified_timestamp = ?', 'updated_at = strftime(\'%s\', \'now\')');
      values.push(username, Date.now());
      values.push(itemId);

      const sql = `UPDATE pr_items SET ${setClause.join(', ')} WHERE id = ?`;

      this.db.run(sql, values, (err) => {
        if (err) {
          reject(err);
        } else {
          this.updatePRStatus(prId).then(() => {
            this.logChange('update', 'item', itemId, { prId, itemId, updates }, username);
            resolve();
          }).catch(reject);
        }
      });
    });
  }

  updatePRStatus(prId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as total, SUM(is_complete) as completed FROM pr_items WHERE pr_id = ?';
      this.db.get(sql, [prId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const newStatus = row.total === row.completed ? 'Completed' : 'In Progress';
          const updateSql = 'UPDATE purchase_requisitions SET status = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?';
          
          this.db.run(updateSql, [newStatus, prId], (updateErr) => {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        }
      });
    });
  }

  deletePR(prId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM purchase_requisitions WHERE id = ?';
      this.db.run(sql, [prId], function(err) {
        if (err) reject(err);
        else {
          resolve(this.changes);
        }
      });
    });
  }

  // Change logging for sync
  logChange(changeType, entityType, entityId, data, username) {
    const sql = `INSERT INTO change_log (change_type, entity_type, entity_id, data, username)
                 VALUES (?, ?, ?, ?, ?)`;
    
    this.db.run(sql, [changeType, entityType, entityId, JSON.stringify(data), username], (err) => {
      if (err) {
        console.error('Error logging change:', err);
      }
    });
  }

  getChangesSince(timestamp) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM change_log WHERE timestamp > ? ORDER BY timestamp';
      this.db.all(sql, [timestamp], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const changes = rows.map(row => ({
            ...row,
            data: JSON.parse(row.data)
          }));
          resolve(changes);
        }
      });
    });
  }
}

module.exports = new DatabaseService();