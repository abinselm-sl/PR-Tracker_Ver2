import NetInfo from '@react-native-net-info';
import DatabaseService from './DatabaseService';
import ApiService from './ApiService';

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncData();
    }, 60000); // Sync every minute
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncData(): Promise<void> {
    if (this.isSyncing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    this.isSyncing = true;

    try {
      // Upload pending changes
      await this.uploadPendingChanges();
      
      // Download remote changes
      await this.downloadRemoteChanges();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async uploadPendingChanges(): Promise<void> {
    const queue = await DatabaseService.getSyncQueue();
    
    for (const item of queue) {
      try {
        await ApiService.syncChanges([item]);
        await DatabaseService.removeSyncQueueItem(item.id);
      } catch (error) {
        console.error('Failed to sync item:', item, error);
        // Implement retry logic here if needed
      }
    }
  }

  private async downloadRemoteChanges(): Promise<void> {
    try {
      // Get last sync timestamp (implement this)
      const lastSync = 0; // Get from storage
      const changes = await ApiService.getChangesSince(lastSync);
      
      // Apply changes to local database
      for (const change of changes) {
        await this.applyRemoteChange(change);
      }
      
      // Update last sync timestamp
      // Save to storage
    } catch (error) {
      console.error('Failed to download remote changes:', error);
    }
  }

  private async applyRemoteChange(change: any): Promise<void> {
    switch (change.type) {
      case 'pr_created':
        await DatabaseService.addPR(change.data);
        break;
      case 'pr_updated':
        // Implement PR update logic
        break;
      case 'item_updated':
        await DatabaseService.updatePRItem(
          change.data.prId,
          change.data.itemId,
          change.data.updates,
          change.data.userName
        );
        break;
      case 'pr_deleted':
        await DatabaseService.deletePR(change.data.prId);
        break;
      default:
        console.warn('Unknown change type:', change.type);
    }
  }

  queueUpdate(operationType: string, data: any): void {
    DatabaseService.addToSyncQueue(operationType, data);
  }

  async forceSyncNow(): Promise<void> {
    await this.syncData();
  }
}

export default new SyncService();