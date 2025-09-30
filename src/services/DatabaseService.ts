import SQLite from 'react-native-sqlite-storage';
import {PurchaseRequisition, PRItem, PRStatus} from '../types';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

class DatabaseService {
  private database: SQLite.SQLiteDatabase | null = null;

  async initializeDatabase(): Promise<void> {
    try {
      this.database = await SQLite.openDatabase({
        name: 'LogisticsPR.db',
        location: 'default',
      });

      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    const createPRsTable = `
      CREATE TABLE IF NOT EXISTS purchase_requisitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        status TEXT NOT NULL,
        requisition_by TEXT,
        approved_by TEXT,
        last_modified_by TEXT,
        last_modified_timestamp INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        sync_status TEXT DEFAULT 'pending'
      );
    `;

    const createItemsTable = `
      CREATE TABLE IF NOT EXISTS pr_items (
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
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (pr_id) REFERENCES purchase_requisitions (id) ON DELETE CASCADE
      );
    `;

    const createSyncQueueTable = `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        retry_count INTEGER DEFAULT 0
      );
    `;

    await this.database.executeSql(createPRsTable);
    await this.database.executeSql(createItemsTable);
    await this.database.executeSql(createSyncQueueTable);
  }

  async getAllPRs(): Promise<PurchaseRequisition[]> {
    if (!this.database) throw new Error('Database not initialized');

    const [results] = await this.database.executeSql(
      'SELECT * FROM purchase_requisitions ORDER BY created_at DESC'
    );

    const prs: PurchaseRequisition[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      const items = await this.getPRItems(row.id);
      
      prs.push({
        id: row.id,
        name: row.name,
        issueDate: row.issue_date,
        status: row.status as PRStatus,
        items,
        requisitionBy: row.requisition_by || 'N/A',
        approvedBy: row.approved_by || 'N/A',
        lastModifiedBy: row.last_modified_by ? {
          userName: row.last_modified_by,
          timestamp: row.last_modified_timestamp,
        } : undefined,
      });
    }

    return prs;
  }

  async getPRItems(prId: string): Promise<PRItem[]> {
    if (!this.database) throw new Error('Database not initialized');

    const [results] = await this.database.executeSql(
      'SELECT * FROM pr_items WHERE pr_id = ? ORDER BY created_at',
      [prId]
    );

    const items: PRItem[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      items.push({
        id: row.id,
        description: row.description,
        originalQuantity: row.original_quantity,
        receivedQuantity: row.received_quantity,
        comment: row.comment || '',
        isComplete: row.is_complete === 1,
        lastModifiedBy: row.last_modified_by ? {
          userName: row.last_modified_by,
          timestamp: row.last_modified_timestamp,
        } : undefined,
      });
    }

    return items;
  }

  async addPR(pr: PurchaseRequisition): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.transaction(async (tx) => {
      // Insert PR
      await tx.executeSql(
        `INSERT INTO purchase_requisitions 
         (id, name, issue_date, status, requisition_by, approved_by, last_modified_by, last_modified_timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pr.id,
          pr.name,
          pr.issueDate,
          pr.status,
          pr.requisitionBy,
          pr.approvedBy,
          pr.lastModifiedBy?.userName || null,
          pr.lastModifiedBy?.timestamp || null,
        ]
      );

      // Insert items
      for (const item of pr.items) {
        await tx.executeSql(
          `INSERT INTO pr_items 
           (id, pr_id, description, original_quantity, received_quantity, comment, is_complete, last_modified_by, last_modified_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            pr.id,
            item.description,
            item.originalQuantity,
            item.receivedQuantity,
            item.comment,
            item.isComplete ? 1 : 0,
            item.lastModifiedBy?.userName || null,
            item.lastModifiedBy?.timestamp || null,
          ]
        );
      }
    });
  }

  async updatePRItem(prId: string, itemId: string, updates: Partial<PRItem>, userName: string): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

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

    setClause.push('last_modified_by = ?', 'last_modified_timestamp = ?', 'updated_at = strftime(\'%s\', \'now\')', 'sync_status = ?');
    values.push(userName, Date.now(), 'pending');

    values.push(itemId);

    await this.database.executeSql(
      `UPDATE pr_items SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    // Update PR status if all items are complete
    await this.updatePRStatus(prId);
  }

  private async updatePRStatus(prId: string): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    const [results] = await this.database.executeSql(
      'SELECT COUNT(*) as total, SUM(is_complete) as completed FROM pr_items WHERE pr_id = ?',
      [prId]
    );

    const row = results.rows.item(0);
    const newStatus = row.total === row.completed ? PRStatus.Completed : PRStatus.InProgress;

    await this.database.executeSql(
      'UPDATE purchase_requisitions SET status = ?, updated_at = strftime(\'%s\', \'now\'), sync_status = ? WHERE id = ?',
      [newStatus, 'pending', prId]
    );
  }

  async deletePR(prId: string): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql(
      'DELETE FROM purchase_requisitions WHERE id = ?',
      [prId]
    );
  }

  async addToSyncQueue(operationType: string, data: any): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql(
      'INSERT INTO sync_queue (operation_type, data) VALUES (?, ?)',
      [operationType, JSON.stringify(data)]
    );
  }

  async getSyncQueue(): Promise<any[]> {
    if (!this.database) throw new Error('Database not initialized');

    const [results] = await this.database.executeSql(
      'SELECT * FROM sync_queue ORDER BY created_at'
    );

    const queue = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      queue.push({
        id: row.id,
        operationType: row.operation_type,
        data: JSON.parse(row.data),
        createdAt: row.created_at,
        retryCount: row.retry_count,
      });
    }

    return queue;
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql(
      'DELETE FROM sync_queue WHERE id = ?',
      [id]
    );
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.executeSql('DELETE FROM sync_queue');
  }
}

export default new DatabaseService();