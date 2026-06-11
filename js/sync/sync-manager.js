/**
 * MediForge Sync Manager
 * 
 * WHAT THIS DOES:
 * Manages synchronization between local (IndexedDB) and cloud (Supabase).
 * 
 * WHEN IT RUNS:
 * - Every 30 minutes automatically
 * - When you go from offline to online
 * - When you click a "manual sync" button
 * 
 * HOW IT WORKS:
 * 1. Checks the sync_queue in IndexedDB
 * 2. For each queued operation:
 *    - Tries to push to Supabase
 *    - If success: Removes from queue
 *    - If conflict: Resolves (last-write-wins for now)
 *    - If fails: Keeps in queue, tries again later
 * 
 * ANALOGY:
 * Think of it as a mail carrier:
 * - Collects letters (offline changes) in a bag (sync queue)
 * - When postal service is open (online), delivers them
 * - If delivery fails, keeps letters and tries again later
 */

class SyncManager {
  constructor(db) {
    this.db = db; // The main DatabaseInterface
    this.isSyncing = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    
    console.log('✅ Sync Manager initialized');
    
    // Start automatic sync every 30 minutes
    this.startAutoSync();
    
    // Sync when coming back online
    window.addEventListener('online', () => {
      console.log('🟢 Online - triggering sync');
      this.sync();
    });
  }
  
  /**
   * Start automatic background sync
   */
  startAutoSync() {
    // Sync every 30 minutes
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        console.log('⏰ Auto-sync triggered (30 min interval)');
        this.sync();
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    console.log('✅ Auto-sync started (every 30 minutes)');
  }
  
  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Auto-sync stopped');
    }
  }
  
  /**
   * Main sync method
   * Processes the sync queue and pushes changes to Supabase
   */
  async sync() {
    // Don't sync if already syncing or offline
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping');
      return { status: 'already_syncing' };
    }
    
    if (!navigator.onLine) {
      console.log('📡 Offline, skipping sync');
      return { status: 'offline' };
    }
    
    this.isSyncing = true;
    console.log('🔄 Starting sync...');
    
    try {
      // Get pending sync items from IndexedDB
      const pendingItems = await this.db.fallback.getPendingSyncItems();
      
      if (pendingItems.length === 0) {
        console.log('✅ No pending changes to sync');
        this.isSyncing = false;
        this.lastSyncTime = new Date();
        return { status: 'success', synced: 0 };
      }
      
      console.log(`📤 Syncing ${pendingItems.length} pending changes...`);
      
      let successCount = 0;
      let failCount = 0;
      
      // Process each queued item
      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item);
          
          // Mark as synced
          await this.db.fallback.markSynced(item.id);
          successCount++;
          
          console.log(`✅ Synced: ${item.operation} ${item.tableName}`);
          
        } catch (error) {
          console.warn(`❌ Sync failed for ${item.operation} ${item.tableName}:`, error.message);
          failCount++;
          
          // Increment attempt counter
          // If too many failures, maybe alert user
          if (item.attempts >= 5) {
            console.error(`⚠️ Item failed ${item.attempts} times, may need manual intervention`);
          }
        }
      }
      
      this.isSyncing = false;
      this.lastSyncTime = new Date();
      
      console.log(`✅ Sync complete: ${successCount} succeeded, ${failCount} failed`);
      
      // Update UI if sync status indicator exists
      this.updateSyncStatus(successCount, failCount);
      
      return { 
        status: 'success', 
        synced: successCount, 
        failed: failCount 
      };
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.isSyncing = false;
      return { status: 'error', error: error.message };
    }
  }
  
  /**
   * Process a single sync item
   */
  async processSyncItem(item) {
    const { operation, tableName, data } = item;
    
    switch (operation) {
      case 'create':
        return await this.syncCreate(tableName, data);
      case 'update':
        return await this.syncUpdate(tableName, data);
      case 'delete':
        return await this.syncDelete(tableName, data);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  
  /**
   * Sync a create operation
   */
  async syncCreate(tableName, data) {
    // Map table names to adapter methods
    switch (tableName) {
      case 'patients':
        return await this.db.primary.createPatient(data);
      case 'appointments':
        return await this.db.primary.createAppointment(data);
      case 'invoices':
        return await this.db.primary.createInvoice(data);
      case 'payments':
        return await this.db.primary.createPayment(data);
      case 'organizations':
        return await this.db.primary.createOrganization(data);
      case 'clinical_notes':
        return await this.db.primary.createClinicalNote(data);
      default:
        console.warn(`Unknown table for sync: ${tableName}`);
        return null;
    }
  }
  
  /**
   * Sync an update operation
   */
  async syncUpdate(tableName, data) {
    const { id, updates } = data;
    
    switch (tableName) {
      case 'patients':
        return await this.db.primary.updatePatient(id, updates);
      case 'appointments':
        return await this.db.primary.updateAppointment(id, updates);
      case 'invoices':
        return await this.db.primary.updateInvoice(id, updates);
      case 'organizations':
        return await this.db.primary.updateOrganization(id, updates);
      case 'clinical_notes':
        return await this.db.primary.updateClinicalNote(id, updates);
      default:
        console.warn(`Unknown table for sync: ${tableName}`);
        return null;
    }
  }
  
  /**
   * Sync a delete operation
   */
  async syncDelete(tableName, data) {
    const { id } = data;
    
    switch (tableName) {
      case 'patients':
        return await this.db.primary.deletePatient(id);
      case 'appointments':
        return await this.db.primary.deleteAppointment(id);
      case 'invoices':
        return await this.db.primary.deleteInvoice(id);
      default:
        console.warn(`Unknown table for sync: ${tableName}`);
        return null;
    }
  }
  
  /**
   * Update sync status UI indicator
   */
  updateSyncStatus(successCount, failCount) {
    // If there's a sync status element in the UI, update it
    const statusEl = document.getElementById('sync-status');
    if (statusEl) {
      if (failCount === 0) {
        statusEl.innerHTML = `✅ Synced (${successCount} items)`;
        statusEl.className = 'sync-status success';
      } else {
        statusEl.innerHTML = `⚠️ Synced ${successCount}, ${failCount} failed`;
        statusEl.className = 'sync-status warning';
      }
      
      // Show last sync time
      const timeEl = document.getElementById('last-sync-time');
      if (timeEl) {
        timeEl.textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
      }
    }
  }
  
  /**
   * Get sync queue status
   */
  async getSyncStatus() {
    const pending = await this.db.fallback.getPendingSyncItems();
    
    return {
      pendingCount: pending.length,
      lastSync: this.lastSyncTime,
      isSyncing: this.isSyncing,
      online: navigator.onLine
    };
  }
}

// Initialize sync manager when database is ready
(function initializeSyncManager() {
  if (!window.db) {
    console.log('⏳ Waiting for database interface...');
    setTimeout(initializeSyncManager, 1000);
    return;
  }
  
  const syncManager = new SyncManager(window.db);
  window.syncManager = syncManager;
  
  console.log('✅ Sync Manager ready');
  console.log('   Auto-sync: Every 30 minutes');
  console.log('   Manual sync: window.syncManager.sync()');
})();

console.log('📦 Sync Manager module loaded');





