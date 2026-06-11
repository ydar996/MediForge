/**
 * MediForge Database Interface
 * 
 * THIS IS THE MOST IMPORTANT FILE!
 * 
 * WHAT IT DOES:
 * This is the ONLY interface your app uses. It's like a smart assistant that:
 * 1. Checks if you're online or offline
 * 2. Routes requests to the right adapter (Supabase or IndexedDB)
 * 3. Handles errors gracefully
 * 4. Queues changes for sync when offline
 * 
 * YOUR APP CODE:
 * Instead of: localStorage.getItem('patients')
 * You now call: db.patients.getAll(orgId)
 * 
 * The interface handles:
 * - Am I online? Use Supabase (fast, up-to-date)
 * - Am I offline? Use IndexedDB (works without internet)
 * - Error? Fall back to IndexedDB
 * - Coming back online? Sync queued changes
 * 
 * MAGIC:
 * Your app code never changes, even if you switch from Supabase to Firebase!
 */

class DatabaseInterface {
  constructor(primaryAdapter, fallbackAdapter) {
    this.primary = primaryAdapter;     // Supabase (cloud)
    this.fallback = fallbackAdapter;   // IndexedDB (local)
    this.isOnline = navigator.onLine;
    
    // Listen for connectivity changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🟢 Connection restored - will sync queued changes');
      this.triggerSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Connection lost - switching to offline mode');
    });
    
    console.log('✅ Database Interface initialized');
    console.log(`   Primary adapter: ${this.primary.name}`);
    console.log(`   Fallback adapter: ${this.fallback.name}`);
    console.log(`   Currently: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
  }
  
  /**
   * Trigger background sync (will implement in sync-manager.js)
   */
  triggerSync() {
    if (typeof window.syncManager !== 'undefined' && typeof window.syncManager.sync === 'function') {
      window.syncManager.sync();
    }
  }
  
  // ============================================================================
  // ORGANIZATIONS API
  // ============================================================================
  
  organizations = {
    /**
     * Get all organizations
     * STRATEGY: Try cloud first (most up-to-date), fall back to local
     */
    getAll: async () => {
      try {
        if (this.isOnline) {
          const data = await this.primary.getOrganizations();
          // Cache in IndexedDB for offline access
          await this.cacheOrganizations(data);
          return data;
        } else {
          return await this.fallback.getOrganizations();
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getOrganizations();
      }
    },
    
    getById: async (id) => {
      try {
        if (this.isOnline) {
          return await this.primary.getOrganizationById(id);
        } else {
          return await this.fallback.getOrganizationById(id);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getOrganizationById(id);
      }
    },
    
    getByName: async (name) => {
      try {
        if (this.isOnline) {
          return await this.primary.getOrganizationByName(name);
        } else {
          return await this.fallback.getOrganizationByName(name);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getOrganizationByName(name);
      }
    },
    
    create: async (org) => {
      // Save to local immediately (fast UX)
      const localResult = await this.fallback.createOrganization(org);
      
      // Try to sync to cloud
      if (this.isOnline) {
        try {
          await this.primary.createOrganization(org);
          return { ...localResult, synced: true };
        } catch (error) {
          console.warn('Cloud save failed, queued for sync:', error.message);
          await this.fallback.queueForSync('create', 'organizations', org);
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('create', 'organizations', org);
        return { ...localResult, synced: false };
      }
    },
    
    update: async (id, updates) => {
      const localResult = await this.fallback.updateOrganization(id, updates);
      
      if (this.isOnline) {
        try {
          await this.primary.updateOrganization(id, updates);
          return { ...localResult, synced: true };
        } catch (error) {
          console.warn('Cloud update failed, queued for sync:', error.message);
          await this.fallback.queueForSync('update', 'organizations', { id, updates });
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('update', 'organizations', { id, updates });
        return { ...localResult, synced: false };
      }
    }
  };
  
  // ============================================================================
  // PATIENTS API
  // ============================================================================
  
  patients = {
    /**
     * Get all patients for an organization
     * EXPLANATION:
     * 1. If online: Fetch from Supabase (most current data)
     * 2. Cache result in IndexedDB (for offline access)
     * 3. If offline or error: Use IndexedDB cache
     */
    getAll: async (orgId) => {
      try {
        if (this.isOnline) {
          const data = await this.primary.getPatientsByOrganization(orgId);
          // Cache for offline use
          await this.cachePatients(data);
          return data;
        } else {
          return await this.fallback.getPatientsByOrganization(orgId);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getPatientsByOrganization(orgId);
      }
    },
    
    getById: async (id) => {
      try {
        if (this.isOnline) {
          return await this.primary.getPatientById(id);
        } else {
          return await this.fallback.getPatientById(id);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getPatientById(id);
      }
    },
    
    getByPatientId: async (orgId, patientId) => {
      try {
        if (this.isOnline) {
          return await this.primary.getPatientByPatientId(orgId, patientId);
        } else {
          return await this.fallback.getPatientByPatientId(orgId, patientId);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getPatientByPatientId(orgId, patientId);
      }
    },
    
    /**
     * Create a new patient
     * STRATEGY: Save locally first (instant), then sync to cloud
     */
    create: async (patient) => {
      // Save to IndexedDB immediately (fast, user sees success right away)
      const localResult = await this.fallback.createPatient(patient);
      
      // Try to sync to Supabase in background
      if (this.isOnline) {
        try {
          const cloudResult = await this.primary.createPatient(patient);
          return { ...cloudResult, synced: true };
        } catch (error) {
          console.warn('Cloud save failed, queued for sync:', error.message);
          await this.fallback.queueForSync('create', 'patients', patient);
          return { ...localResult, synced: false };
        }
      } else {
        // Offline: Queue for later sync
        await this.fallback.queueForSync('create', 'patients', patient);
        return { ...localResult, synced: false };
      }
    },
    
    update: async (id, updates) => {
      const localResult = await this.fallback.updatePatient(id, updates);
      
      if (this.isOnline) {
        try {
          const cloudResult = await this.primary.updatePatient(id, updates);
          return { ...cloudResult, synced: true };
        } catch (error) {
          console.warn('Cloud update failed, queued for sync:', error.message);
          await this.fallback.queueForSync('update', 'patients', { id, updates });
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('update', 'patients', { id, updates });
        return { ...localResult, synced: false };
      }
    },
    
    delete: async (id) => {
      const localResult = await this.fallback.deletePatient(id);
      
      if (this.isOnline) {
        try {
          await this.primary.deletePatient(id);
          return { ...localResult, synced: true };
        } catch (error) {
          console.warn('Cloud delete failed, queued for sync:', error.message);
          await this.fallback.queueForSync('delete', 'patients', { id });
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('delete', 'patients', { id });
        return { ...localResult, synced: false };
      }
    },
    
    search: async (orgId, searchTerm) => {
      try {
        if (this.isOnline) {
          return await this.primary.searchPatients(orgId, searchTerm);
        } else {
          return await this.fallback.searchPatients(orgId, searchTerm);
        }
      } catch (error) {
        console.warn('Primary search failed, using fallback:', error.message);
        return await this.fallback.searchPatients(orgId, searchTerm);
      }
    }
  };
  
  // ============================================================================
  // APPOINTMENTS API
  // ============================================================================
  
  appointments = {
    getAll: async (orgId) => {
      try {
        if (this.isOnline) {
          const data = await this.primary.getAppointmentsByOrganization(orgId);
          await this.cacheAppointments(data);
          return data;
        } else {
          return await this.fallback.getAppointmentsByOrganization(orgId);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getAppointmentsByOrganization(orgId);
      }
    },
    
    getByDate: async (orgId, date) => {
      try {
        if (this.isOnline) {
          return await this.primary.getAppointmentsByDate(orgId, date);
        } else {
          return await this.fallback.getAppointmentsByDate(orgId, date);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getAppointmentsByDate(orgId, date);
      }
    },
    
    getByPatient: async (patientId) => {
      try {
        if (this.isOnline) {
          return await this.primary.getAppointmentsByPatient(patientId);
        } else {
          return await this.fallback.getAppointmentsByPatient(patientId);
        }
      } catch (error) {
        console.warn('Primary adapter failed, using fallback:', error.message);
        return await this.fallback.getAppointmentsByPatient(patientId);
      }
    },
    
    create: async (appointment) => {
      const localResult = await this.fallback.createAppointment(appointment);
      
      if (this.isOnline) {
        try {
          const cloudResult = await this.primary.createAppointment(appointment);
          return { ...cloudResult, synced: true };
        } catch (error) {
          console.warn('Cloud save failed, queued for sync:', error.message);
          await this.fallback.queueForSync('create', 'appointments', appointment);
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('create', 'appointments', appointment);
        return { ...localResult, synced: false };
      }
    },
    
    update: async (id, updates) => {
      const localResult = await this.fallback.updateAppointment(id, updates);
      
      if (this.isOnline) {
        try {
          const cloudResult = await this.primary.updateAppointment(id, updates);
          return { ...cloudResult, synced: true };
        } catch (error) {
          console.warn('Cloud update failed, queued for sync:', error.message);
          await this.fallback.queueForSync('update', 'appointments', { id, updates });
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('update', 'appointments', { id, updates });
        return { ...localResult, synced: false };
      }
    },
    
    delete: async (id) => {
      const localResult = await this.fallback.deleteAppointment(id);
      
      if (this.isOnline) {
        try {
          await this.primary.deleteAppointment(id);
          return { ...localResult, synced: true };
        } catch (error) {
          console.warn('Cloud delete failed, queued for sync:', error.message);
          await this.fallback.queueForSync('delete', 'appointments', { id });
          return { ...localResult, synced: false };
        }
      } else {
        await this.fallback.queueForSync('delete', 'appointments', { id });
        return { ...localResult, synced: false };
      }
    }
  };
  
  // ============================================================================
  // HELPER METHODS FOR CACHING
  // ============================================================================
  
  async cacheOrganizations(organizations) {
    // Store in IndexedDB for offline access
    for (const org of organizations) {
      try {
        await this.fallback.createOrganization(org);
      } catch (error) {
        // Might already exist, try update
        try {
          await this.fallback.updateOrganization(org.id, org);
        } catch (e) {
          console.warn('Could not cache organization:', org.name, e.message);
        }
      }
    }
  }
  
  async cachePatients(patients) {
    for (const patient of patients) {
      try {
        await this.fallback.createPatient(patient);
      } catch (error) {
        try {
          await this.fallback.updatePatient(patient.id, patient);
        } catch (e) {
          console.warn('Could not cache patient:', patient.patient_id, e.message);
        }
      }
    }
  }
  
  async cacheAppointments(appointments) {
    for (const appt of appointments) {
      try {
        await this.fallback.createAppointment(appt);
      } catch (error) {
        try {
          await this.fallback.updateAppointment(appt.id, appt);
        } catch (e) {
          console.warn('Could not cache appointment:', appt.id, e.message);
        }
      }
    }
  }
  
  // ============================================================================
  // HEALTH CHECK
  // ============================================================================
  
  async healthCheck() {
    const [primaryHealth, fallbackHealth] = await Promise.all([
      this.primary.healthCheck().catch(err => ({ healthy: false, error: err.message })),
      this.fallback.healthCheck().catch(err => ({ healthy: false, error: err.message }))
    ]);
    
    return {
      primary: primaryHealth,
      fallback: fallbackHealth,
      online: this.isOnline
    };
  }
}

// Initialize the global database interface
// This is what your app will use!

(async function initializeDatabase() {
  // Wait for Supabase client to be ready
  if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not ready yet, retrying in 1 second...');
    setTimeout(initializeDatabase, 1000);
    return;
  }
  
  // Wait for adapter classes to be loaded
  if (!window.SupabaseAdapter || !window.IndexedDBAdapter) {
    console.warn('⚠️ Adapters not loaded yet, retrying in 1 second...');
    setTimeout(initializeDatabase, 1000);
    return;
  }
  
  try {
    // Create the adapters
    const supabaseAdapter = new SupabaseAdapter(window.supabaseClient);
    const indexedDBAdapter = new IndexedDBAdapter('mediforge_db');
    
    // Wait for IndexedDB to initialize
    await indexedDBAdapter.initPromise;
    
    // Create the main database interface
    const db = new DatabaseInterface(supabaseAdapter, indexedDBAdapter);
    
    // Make available globally
    window.db = db;
    
    console.log('✅ Database interface ready!');
    console.log('   Use: db.patients.getAll(orgId)');
    console.log('   Use: db.appointments.create(appointment)');
    console.log('   etc.');
    
    // Run health check
    const health = await db.healthCheck();
    console.log('🏥 Health check:', health);
    
  } catch (error) {
    console.error('❌ Failed to initialize database interface:', error);
  }
})();

console.log('📦 Database interface module loaded');





