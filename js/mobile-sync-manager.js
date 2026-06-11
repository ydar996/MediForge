/**
 * Mobile Sync Manager
 * Ensures data from mobile devices always reaches Supabase
 */

class MobileSyncManager {
    constructor() {
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // Start with 1 second
        
        this.init();
    }
    
    init() {
        console.log('🔄 Mobile Sync Manager initialized');
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('📱 Device came online - starting sync');
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            console.log('📱 Device went offline - queuing sync');
            this.isOnline = false;
        });
        
        // Auto-sync on page load
        this.loadSyncQueue();
        this.processSyncQueue();
        
        // Periodic sync every 30 seconds when online
        setInterval(() => {
            if (this.isOnline) {
                this.processSyncQueue();
            }
        }, 30000);
    }
    
    // Add data to sync queue
    addToSyncQueue(data, type) {
        const syncItem = {
            id: Date.now() + Math.random(),
            type: type, // 'organization' or 'user'
            data: data,
            timestamp: new Date().toISOString(),
            attempts: 0
        };
        
        this.syncQueue.push(syncItem);
        this.saveSyncQueue();
        
        console.log(`📱 Added ${type} to sync queue:`, syncItem.id);
        
        // Try to sync immediately if online
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }
    
    // Process sync queue
    async processSyncQueue() {
        if (!this.isOnline || this.syncQueue.length === 0) {
            return;
        }
        
        console.log(`🔄 Processing ${this.syncQueue.length} items in sync queue`);
        
        for (let i = this.syncQueue.length - 1; i >= 0; i--) {
            const item = this.syncQueue[i];
            
            try {
                const success = await this.syncItem(item);
                
                if (success) {
                    console.log(`✅ Successfully synced ${item.type}:`, item.id);
                    this.syncQueue.splice(i, 1);
                } else {
                    item.attempts++;
                    if (item.attempts >= this.maxRetries) {
                        console.error(`❌ Max retries reached for ${item.type}:`, item.id);
                        this.syncQueue.splice(i, 1);
                    }
                }
            } catch (error) {
                console.error(`❌ Error syncing ${item.type}:`, error);
                item.attempts++;
            }
        }
        
        this.saveSyncQueue();
    }
    
    // Sync individual item
    async syncItem(item) {
        if (!window.supabaseClient) {
            console.log('⚠️ Supabase client not available');
            return false;
        }
        
        try {
            if (item.type === 'organization') {
                return await this.syncOrganization(item.data);
            } else if (item.type === 'user') {
                return await this.syncUser(item.data);
            }
        } catch (error) {
            console.error(`❌ Sync error for ${item.type}:`, error);
            return false;
        }
    }
    
    // Sync organization to Supabase
    async syncOrganization(orgData) {
        try {
            const { data: orgResult, error: orgError } = await window.supabaseClient
                .from('organizations')
                .insert([{
                    name: orgData.name,
                    country: orgData.country,
                    state: orgData.state,
                    city: orgData.city,
                    address_line1: orgData.addressLine1,
                    address_line2: orgData.addressLine2,
                    phone: orgData.phone,
                    after_hours_phone: orgData.afterHoursPhone,
                    org_code: orgData.orgCode,
                    created_at: orgData.createdAt
                }])
                .select('id');
            
            if (orgError) {
                console.error('❌ Organization sync failed:', orgError);
                return false;
            }
            
            if (orgResult && orgResult[0] && orgResult[0].id) {
                const orgId = orgResult[0].id;
                console.log('✅ Organization synced to Supabase:', orgId);
                
                // Update localStorage with Supabase ID
                const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
                if (organizations[orgData.name]) {
                    organizations[orgData.name].id = orgId;
                    localStorage.setItem('organizations', JSON.stringify(organizations));
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Organization sync error:', error);
            return false;
        }
    }
    
    // Sync user to Supabase
    async syncUser(userData) {
        try {
            // Find organization ID
            const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
            const userOrg = Object.values(organizations).find(org => org.name === userData.org);
            
            if (!userOrg || !userOrg.id) {
                console.error('❌ User organization not found or not synced');
                return false;
            }
            
            const { data: userResult, error: userError } = await window.supabaseClient
                .from('users')
                .insert([{
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    username: userData.username,
                    gender: userData.gender,
                    role: userData.role,
                    organization_id: userOrg.id,
                    created_at: userData.createdAt
                }]);
            
            if (userError) {
                console.error('❌ User sync failed:', userError);
                return false;
            }
            
            console.log('✅ User synced to Supabase');
            
            // Update localStorage with organization ID
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const userIndex = users.findIndex(u => u.username === userData.username);
            if (userIndex !== -1) {
                users[userIndex].organizationId = userOrg.id;
                localStorage.setItem('users', JSON.stringify(users));
            }
            
            return true;
        } catch (error) {
            console.error('❌ User sync error:', error);
            return false;
        }
    }
    
    // Save sync queue to localStorage
    saveSyncQueue() {
        localStorage.setItem('mobileSyncQueue', JSON.stringify(this.syncQueue));
    }
    
    // Load sync queue from localStorage
    loadSyncQueue() {
        const saved = localStorage.getItem('mobileSyncQueue');
        if (saved) {
            this.syncQueue = JSON.parse(saved);
            console.log(`📱 Loaded ${this.syncQueue.length} items from sync queue`);
        }
    }
    
    // Manual sync trigger
    async manualSync() {
        console.log('🔄 Manual sync triggered');
        await this.processSyncQueue();
    }
    
    // Get sync status
    getSyncStatus() {
        return {
            queueLength: this.syncQueue.length,
            isOnline: this.isOnline,
            items: this.syncQueue.map(item => ({
                type: item.type,
                timestamp: item.timestamp,
                attempts: item.attempts
            }))
        };
    }
}

// Initialize mobile sync manager
window.mobileSyncManager = new MobileSyncManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileSyncManager;
}
