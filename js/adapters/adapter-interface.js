/**
 * MediForge Database Adapter Interface
 * 
 * This is the CONTRACT that all database adapters must implement.
 * Think of it as a template - any backend (Supabase, Firebase, etc.) 
 * must provide these exact methods.
 * 
 * This ensures we can swap backends without changing app code!
 */

class DatabaseAdapter {
  constructor(name) {
    this.name = name;
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log(`${this.name} adapter: Now ONLINE`);
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log(`${this.name} adapter: Now OFFLINE`);
    });
  }
  
  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================
  
  async getOrganizations() {
    throw new Error(`${this.name}: getOrganizations() not implemented`);
  }
  
  async getOrganizationById(id) {
    throw new Error(`${this.name}: getOrganizationById() not implemented`);
  }
  
  async getOrganizationByName(name) {
    throw new Error(`${this.name}: getOrganizationByName() not implemented`);
  }
  
  async createOrganization(org) {
    throw new Error(`${this.name}: createOrganization() not implemented`);
  }
  
  async updateOrganization(id, updates) {
    throw new Error(`${this.name}: updateOrganization() not implemented`);
  }
  
  // ============================================================================
  // USERS
  // ============================================================================
  
  async getUsersByOrganization(orgId) {
    throw new Error(`${this.name}: getUsersByOrganization() not implemented`);
  }
  
  async getUserByUsername(username) {
    throw new Error(`${this.name}: getUserByUsername() not implemented`);
  }
  
  async createUser(user) {
    throw new Error(`${this.name}: createUser() not implemented`);
  }
  
  async updateUser(id, updates) {
    throw new Error(`${this.name}: updateUser() not implemented`);
  }
  
  // ============================================================================
  // PATIENTS
  // ============================================================================
  
  async getPatientsByOrganization(orgId) {
    throw new Error(`${this.name}: getPatientsByOrganization() not implemented`);
  }
  
  async getPatientById(id) {
    throw new Error(`${this.name}: getPatientById() not implemented`);
  }
  
  async getPatientByPatientId(orgId, patientId) {
    throw new Error(`${this.name}: getPatientByPatientId() not implemented`);
  }
  
  async createPatient(patient) {
    throw new Error(`${this.name}: createPatient() not implemented`);
  }
  
  async updatePatient(id, updates) {
    throw new Error(`${this.name}: updatePatient() not implemented`);
  }
  
  async deletePatient(id) {
    throw new Error(`${this.name}: deletePatient() not implemented`);
  }
  
  async searchPatients(orgId, searchTerm) {
    throw new Error(`${this.name}: searchPatients() not implemented`);
  }
  
  // ============================================================================
  // APPOINTMENTS
  // ============================================================================
  
  async getAppointmentsByOrganization(orgId) {
    throw new Error(`${this.name}: getAppointmentsByOrganization() not implemented`);
  }
  
  async getAppointmentsByDate(orgId, date) {
    throw new Error(`${this.name}: getAppointmentsByDate() not implemented`);
  }
  
  async getAppointmentsByPatient(patientId) {
    throw new Error(`${this.name}: getAppointmentsByPatient() not implemented`);
  }
  
  async createAppointment(appointment) {
    throw new Error(`${this.name}: createAppointment() not implemented`);
  }
  
  async updateAppointment(id, updates) {
    throw new Error(`${this.name}: updateAppointment() not implemented`);
  }
  
  async deleteAppointment(id) {
    throw new Error(`${this.name}: deleteAppointment() not implemented`);
  }
  
  // ============================================================================
  // CLINICAL NOTES
  // ============================================================================
  
  async getClinicalNotesByPatient(patientId) {
    throw new Error(`${this.name}: getClinicalNotesByPatient() not implemented`);
  }
  
  async createClinicalNote(note) {
    throw new Error(`${this.name}: createClinicalNote() not implemented`);
  }
  
  async updateClinicalNote(id, updates) {
    throw new Error(`${this.name}: updateClinicalNote() not implemented`);
  }
  
  // ============================================================================
  // INVOICES
  // ============================================================================
  
  async getInvoicesByOrganization(orgId) {
    throw new Error(`${this.name}: getInvoicesByOrganization() not implemented`);
  }
  
  async getInvoicesByPatient(patientId) {
    throw new Error(`${this.name}: getInvoicesByPatient() not implemented`);
  }
  
  async getInvoiceById(id) {
    throw new Error(`${this.name}: getInvoiceById() not implemented`);
  }
  
  async createInvoice(invoice) {
    throw new Error(`${this.name}: createInvoice() not implemented`);
  }
  
  async updateInvoice(id, updates) {
    throw new Error(`${this.name}: updateInvoice() not implemented`);
  }
  
  async deleteInvoice(id) {
    throw new Error(`${this.name}: deleteInvoice() not implemented`);
  }
  
  // ============================================================================
  // PAYMENTS
  // ============================================================================
  
  async getPaymentsByOrganization(orgId) {
    throw new Error(`${this.name}: getPaymentsByOrganization() not implemented`);
  }
  
  async getPaymentsByInvoice(invoiceId) {
    throw new Error(`${this.name}: getPaymentsByInvoice() not implemented`);
  }
  
  async createPayment(payment) {
    throw new Error(`${this.name}: createPayment() not implemented`);
  }
  
  // ============================================================================
  // AUDIT LOGS
  // ============================================================================
  
  async getAuditLogsByOrganization(orgId) {
    throw new Error(`${this.name}: getAuditLogsByOrganization() not implemented`);
  }
  
  async createAuditLog(log) {
    throw new Error(`${this.name}: createAuditLog() not implemented`);
  }
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  async getSubscriptionByOrganization(orgId) {
    throw new Error(`${this.name}: getSubscriptionByOrganization() not implemented`);
  }
  
  async createSubscription(subscription) {
    throw new Error(`${this.name}: createSubscription() not implemented`);
  }
  
  async updateSubscription(id, updates) {
    throw new Error(`${this.name}: updateSubscription() not implemented`);
  }
  
  // ============================================================================
  // SERVICES
  // ============================================================================
  
  async getServicesByOrganization(orgId) {
    throw new Error(`${this.name}: getServicesByOrganization() not implemented`);
  }
  
  async createService(service) {
    throw new Error(`${this.name}: createService() not implemented`);
  }
  
  async updateService(id, updates) {
    throw new Error(`${this.name}: updateService() not implemented`);
  }
  
  async deleteService(id) {
    throw new Error(`${this.name}: deleteService() not implemented`);
  }
  
  // ============================================================================
  // SPECIALISTS
  // ============================================================================
  
  async getSpecialistsByOrganization(orgId) {
    throw new Error(`${this.name}: getSpecialistsByOrganization() not implemented`);
  }
  
  async createSpecialist(specialist) {
    throw new Error(`${this.name}: createSpecialist() not implemented`);
  }
  
  async updateSpecialist(id, updates) {
    throw new Error(`${this.name}: updateSpecialist() not implemented`);
  }
  
  async deleteSpecialist(id) {
    throw new Error(`${this.name}: deleteSpecialist() not implemented`);
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  async healthCheck() {
    throw new Error(`${this.name}: healthCheck() not implemented`);
  }
  
  async getStats(orgId) {
    throw new Error(`${this.name}: getStats() not implemented`);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.DatabaseAdapter = DatabaseAdapter;
}

console.log('✅ DatabaseAdapter interface loaded');





