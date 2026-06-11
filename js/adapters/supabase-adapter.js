/**
 * MediForge Supabase Adapter
 * 
 * WHAT THIS FILE DOES:
 * This adapter translates your app's requests into Supabase API calls.
 * 
 * EXAMPLE:
 * When your app calls: db.patients.getAll(orgId)
 * This adapter translates to: supabase.from('patients').select('*').eq('organization_id', orgId)
 * 
 * WHY WE NEED THIS:
 * - Your app code stays simple: db.patients.getAll()
 * - This adapter handles the complex Supabase syntax
 * - If you switch to Firebase later, just swap this adapter!
 */

class SupabaseAdapter extends DatabaseAdapter {
  constructor(supabaseClient) {
    super('SupabaseAdapter');
    this.client = supabaseClient;
    console.log('✅ Supabase Adapter initialized');
  }
  
  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================
  
  /**
   * Get all organizations
   * NOTE: Due to RLS, users will only see their own organization
   */
  async getOrganizations() {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getOrganizations error:', error);
      throw error;
    }
  }
  
  async getOrganizationById(id) {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getOrganizationById error:', error);
      throw error;
    }
  }
  
  async getOrganizationByName(name) {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getOrganizationByName error:', error);
      throw error;
    }
  }
  
  async createOrganization(org) {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .insert(org)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createOrganization error:', error);
      throw error;
    }
  }
  
  async updateOrganization(id, updates) {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateOrganization error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // USERS
  // ============================================================================
  
  async getUsersByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('organization_id', orgId)
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getUsersByOrganization error:', error);
      throw error;
    }
  }
  
  async getUserByUsername(username) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getUserByUsername error:', error);
      throw error;
    }
  }
  
  async createUser(user) {
    try {
      const { data, error } = await this.client
        .from('users')
        .insert(user)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createUser error:', error);
      throw error;
    }
  }
  
  async updateUser(id, updates) {
    try {
      const { data, error } = await this.client
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateUser error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // PATIENTS
  // ============================================================================
  
  /**
   * Get all patients for an organization
   * EXPLANATION: This queries the 'patients' table and filters by organization_id
   * RLS automatically ensures users only see their own organization's patients
   */
  async getPatientsByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .select('*')
        .eq('organization_id', orgId)
        .order('patient_id');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getPatientsByOrganization error:', error);
      throw error;
    }
  }
  
  async getPatientById(id) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getPatientById error:', error);
      throw error;
    }
  }
  
  async getPatientByPatientId(orgId, patientId) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .select('*')
        .eq('organization_id', orgId)
        .eq('patient_id', patientId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getPatientByPatientId error:', error);
      throw error;
    }
  }
  
  async createPatient(patient) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .insert(patient)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createPatient error:', error);
      throw error;
    }
  }
  
  async updatePatient(id, updates) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updatePatient error:', error);
      throw error;
    }
  }
  
  async deletePatient(id) {
    try {
      const { data, error} = await this.client
        .from('patients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('SupabaseAdapter.deletePatient error:', error);
      throw error;
    }
  }
  
  async searchPatients(orgId, searchTerm) {
    try {
      const { data, error } = await this.client
        .from('patients')
        .select('*')
        .eq('organization_id', orgId)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,patient_id.ilike.%${searchTerm}%`);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.searchPatients error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // APPOINTMENTS
  // ============================================================================
  
  async getAppointmentsByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .select('*')
        .eq('organization_id', orgId)
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getAppointmentsByOrganization error:', error);
      throw error;
    }
  }
  
  async getAppointmentsByDate(orgId, date) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('appointment_date', date)
        .order('appointment_time');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getAppointmentsByDate error:', error);
      throw error;
    }
  }
  
  async getAppointmentsByPatient(patientId) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getAppointmentsByPatient error:', error);
      throw error;
    }
  }
  
  async createAppointment(appointment) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .insert(appointment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createAppointment error:', error);
      throw error;
    }
  }
  
  async updateAppointment(id, updates) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateAppointment error:', error);
      throw error;
    }
  }
  
  async deleteAppointment(id) {
    try {
      const { data, error } = await this.client
        .from('appointments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('SupabaseAdapter.deleteAppointment error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // CLINICAL NOTES
  // ============================================================================
  
  async getClinicalNotesByPatient(patientId) {
    try {
      const { data, error } = await this.client
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('note_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getClinicalNotesByPatient error:', error);
      throw error;
    }
  }
  
  async createClinicalNote(note) {
    try {
      const { data, error } = await this.client
        .from('clinical_notes')
        .insert(note)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createClinicalNote error:', error);
      throw error;
    }
  }
  
  async updateClinicalNote(id, updates) {
    try {
      const { data, error } = await this.client
        .from('clinical_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateClinicalNote error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // INVOICES
  // ============================================================================
  
  async getInvoicesByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .select('*')
        .eq('organization_id', orgId)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getInvoicesByOrganization error:', error);
      throw error;
    }
  }
  
  async getInvoicesByPatient(patientId) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .select('*')
        .eq('patient_id', patientId)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getInvoicesByPatient error:', error);
      throw error;
    }
  }
  
  async getInvoiceById(id) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.getInvoiceById error:', error);
      throw error;
    }
  }
  
  async createInvoice(invoice) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .insert(invoice)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createInvoice error:', error);
      throw error;
    }
  }
  
  async updateInvoice(id, updates) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateInvoice error:', error);
      throw error;
    }
  }
  
  async deleteInvoice(id) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('SupabaseAdapter.deleteInvoice error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // PAYMENTS
  // ============================================================================
  
  async getPaymentsByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .select('*')
        .eq('organization_id', orgId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getPaymentsByOrganization error:', error);
      throw error;
    }
  }
  
  async getPaymentsByInvoice(invoiceId) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getPaymentsByInvoice error:', error);
      throw error;
    }
  }
  
  async createPayment(payment) {
    try {
      const { data, error } = await this.client
        .from('payments')
        .insert(payment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createPayment error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // AUDIT LOGS
  // ============================================================================
  
  async getAuditLogsByOrganization(orgId, limit = 100) {
    try {
      const { data, error } = await this.client
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getAuditLogsByOrganization error:', error);
      throw error;
    }
  }
  
  async createAuditLog(log) {
    try {
      const { data, error } = await this.client
        .from('audit_logs')
        .insert(log)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createAuditLog error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  async getSubscriptionByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows, which is ok
      return data || null;
    } catch (error) {
      console.error('SupabaseAdapter.getSubscriptionByOrganization error:', error);
      throw error;
    }
  }
  
  async createSubscription(subscription) {
    try {
      const { data, error } = await this.client
        .from('subscriptions')
        .insert(subscription)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createSubscription error:', error);
      throw error;
    }
  }
  
  async updateSubscription(id, updates) {
    try {
      const { data, error } = await this.client
        .from('subscriptions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateSubscription error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // SERVICES
  // ============================================================================
  
  async getServicesByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('services')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getServicesByOrganization error:', error);
      throw error;
    }
  }
  
  async createService(service) {
    try {
      const { data, error } = await this.client
        .from('services')
        .insert(service)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createService error:', error);
      throw error;
    }
  }
  
  async updateService(id, updates) {
    try {
      const { data, error } = await this.client
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateService error:', error);
      throw error;
    }
  }
  
  async deleteService(id) {
    try {
      // Soft delete - just mark as inactive
      const { data, error } = await this.client
        .from('services')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.deleteService error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // SPECIALISTS
  // ============================================================================
  
  async getSpecialistsByOrganization(orgId) {
    try {
      const { data, error } = await this.client
        .from('specialists')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('last_name');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('SupabaseAdapter.getSpecialistsByOrganization error:', error);
      throw error;
    }
  }
  
  async createSpecialist(specialist) {
    try {
      const { data, error } = await this.client
        .from('specialists')
        .insert(specialist)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.createSpecialist error:', error);
      throw error;
    }
  }
  
  async updateSpecialist(id, updates) {
    try {
      const { data, error } = await this.client
        .from('specialists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.updateSpecialist error:', error);
      throw error;
    }
  }
  
  async deleteSpecialist(id) {
    try {
      // Soft delete
      const { data, error } = await this.client
        .from('specialists')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('SupabaseAdapter.deleteSpecialist error:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Health check - tests if Supabase is reachable
   */
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('count', { count: 'exact', head: true });
      
      // Even if RLS blocks, connection is working
      return { 
        healthy: true, 
        adapter: this.name,
        online: this.isOnline,
        error: error?.message || null
      };
    } catch (error) {
      return { 
        healthy: false, 
        adapter: this.name,
        online: this.isOnline,
        error: error.message 
      };
    }
  }
  
  /**
   * Get organization statistics
   */
  async getStats(orgId) {
    try {
      const [patients, appointments, invoices] = await Promise.all([
        this.client.from('patients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        this.client.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        this.client.from('invoices').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
      ]);
      
      return {
        patientCount: patients.count || 0,
        appointmentCount: appointments.count || 0,
        invoiceCount: invoices.count || 0
      };
    } catch (error) {
      console.error('SupabaseAdapter.getStats error:', error);
      return {
        patientCount: 0,
        appointmentCount: 0,
        invoiceCount: 0
      };
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.SupabaseAdapter = SupabaseAdapter;
}

console.log('✅ Supabase Adapter loaded');





