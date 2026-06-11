const ENCRYPT_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
const encryptionLog = (...args) => { if (ENCRYPT_VERBOSE) console.log(...args); };

/**
 * MediForge Encryption Service
 * 
 * Purpose: End-to-End Encryption (E2E) for PHI (Protected Health Information)
 * Algorithm: AES-256-GCM (Galois/Counter Mode)
 * Key Derivation: PBKDF2 with SHA-256, 100,000 iterations
 * 
 * IMPORTANT: This service is designed to be backward compatible.
 * - Unencrypted data will continue to work
 * - Encryption failures fall back gracefully
 * - No breaking changes to existing functionality
 * 
 * Version: 1.0.0
 * Created: November 2025
 */

class EncryptionService {
  constructor() {
    this.isInitialized = false;
    this.encryptionKey = null;
    this.salt = null;
    this.organizationId = null;
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.iterations = 100000;
  }

  /**
   * Initialize encryption for current organization
   * Called once per session when user logs in
   * 
   * @param {string} organizationId - Organization UUID
   * @param {string} masterPassword - Master encryption password (never stored)
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize(organizationId, masterPassword) {
    try {
      if (!organizationId || !masterPassword) {
        console.warn('⚠️ EncryptionService: Missing organizationId or masterPassword');
        return false;
      }

      this.organizationId = organizationId;

      // Get or generate salt for this organization
      this.salt = await this.getOrCreateSalt(organizationId);
      
      if (!this.salt) {
        console.warn('⚠️ EncryptionService: Could not get or create salt');
        return false;
      }
      
      // Derive encryption key from master password
      this.encryptionKey = await this.deriveKey(masterPassword, this.salt);
      
      if (!this.encryptionKey) {
        console.warn('⚠️ EncryptionService: Could not derive encryption key');
        return false;
      }
      
      this.isInitialized = true;
      encryptionLog('✅ EncryptionService: Initialized successfully');
      return true;
    } catch (error) {
      console.warn('⚠️ EncryptionService: Initialization failed:', error);
      // Continue without encryption (backward compatible)
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get or create encryption salt for organization
   * Salt is stored in Supabase organizations.settings.encryption_salt
   * 
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<Uint8Array>} - Salt as Uint8Array
   */
  async getOrCreateSalt(organizationId) {
    // Try to get from Supabase first
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('organizations')
          .select('settings')
          .eq('id', organizationId)
          .single();
        
        if (!error && data && data.settings) {
          // Check if salt exists in settings
          if (data.settings.encryption_salt) {
            // Convert base64 salt to Uint8Array
            try {
              const saltBase64 = data.settings.encryption_salt;
              const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
              encryptionLog('✅ EncryptionService: Retrieved existing salt from Supabase');
              return saltBytes;
            } catch (err) {
              console.warn('⚠️ EncryptionService: Error parsing salt from Supabase:', err);
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ EncryptionService: Could not fetch salt from Supabase:', err);
      }
    }
    
    // Generate new salt if not found
    encryptionLog('🔐 EncryptionService: Generating new salt');
    const newSalt = crypto.getRandomValues(new Uint8Array(16)); // 128-bit salt
    
    // Save to Supabase
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
      try {
        // Get existing settings first
        const { data: existingData } = await window.supabaseClient
          .from('organizations')
          .select('settings')
          .eq('id', organizationId)
          .single();
        
        const existingSettings = existingData?.settings || {};
        
        // Update settings with new salt
        const { error: updateError } = await window.supabaseClient
          .from('organizations')
          .update({
            settings: {
              ...existingSettings,
              encryption_salt: btoa(String.fromCharCode(...newSalt)),
              encryption_enabled: true,
              encryption_setup_date: new Date().toISOString()
            }
          })
          .eq('id', organizationId);
        
        if (updateError) {
          console.warn('⚠️ EncryptionService: Could not save salt to Supabase:', updateError);
          // Continue anyway - salt is in memory
        } else {
          encryptionLog('✅ EncryptionService: Saved new salt to Supabase');
        }
      } catch (err) {
        console.warn('⚠️ EncryptionService: Error saving salt to Supabase:', err);
        // Continue anyway - salt is in memory
      }
    }
    
    return newSalt;
  }

  /**
   * Derive encryption key using PBKDF2
   * 
   * @param {string} password - Master password
   * @param {Uint8Array} salt - Salt for key derivation
   * @returns {Promise<CryptoKey>} - Derived encryption key
   */
  async deriveKey(password, salt) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: this.algorithm, length: this.keyLength },
        true,
        ['encrypt', 'decrypt']
      );
      
      return key;
    } catch (error) {
      console.error('❌ EncryptionService: Key derivation failed:', error);
      return null;
    }
  }

  /**
   * Encrypt data before storage
   * 
   * @param {any} data - Data to encrypt (will be JSON stringified)
   * @returns {Promise<{encrypted: boolean, data: any}>} - Encrypted data or original if encryption failed
   */
  async encrypt(data) {
    // If encryption not initialized, return unencrypted (backward compatible)
    if (!this.isInitialized || !this.encryptionKey) {
      return { encrypted: false, data: data };
    }

    // If data is null or undefined, return as-is
    if (data === null || data === undefined) {
      return { encrypted: false, data: data };
    }

    try {
      const encoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      const dataBytes = encoder.encode(dataString);
      
      // Generate random IV for each encryption (96-bit IV for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.encryptionKey,
        dataBytes
      );
      
      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Base64 encode
      const encryptedBase64 = btoa(String.fromCharCode(...combined));
      
      return {
        encrypted: true,
        data: encryptedBase64
      };
    } catch (error) {
      console.warn('⚠️ EncryptionService: Encryption failed, storing unencrypted:', error);
      // Fallback: return unencrypted (backward compatible)
      return { encrypted: false, data: data };
    }
  }

  /**
   * Decrypt data after retrieval
   * Handles both encrypted and unencrypted data (backward compatible)
   * 
   * @param {any} encryptedData - Encrypted data or unencrypted data
   * @returns {Promise<any>} - Decrypted data or original if decryption not needed/failed
   */
  async decrypt(encryptedData) {
    // If data is null or undefined, return as-is
    if (encryptedData === null || encryptedData === undefined) {
      return encryptedData;
    }

    // Check if data is encrypted object
    if (typeof encryptedData === 'object' && encryptedData.encrypted === false) {
      // Already marked as unencrypted
      return encryptedData.data;
    }

    if (typeof encryptedData === 'object' && encryptedData.encrypted === true) {
      // Encrypted object, decrypt the data field
      return await this.decryptString(encryptedData.data);
    }

    // Check if it's a base64 string (might be encrypted)
    if (typeof encryptedData === 'string') {
      // First, try to parse as JSON (might be unencrypted JSON)
      try {
        const parsed = JSON.parse(encryptedData);
        // If it's an object with encrypted flag, decrypt it
        if (typeof parsed === 'object' && parsed.encrypted === true) {
          return await this.decryptString(parsed.data);
        }
        // Otherwise, it's unencrypted JSON, return it
        return parsed;
      } catch (e) {
        // Not JSON, might be encrypted base64 string
        // Try to decrypt it
        if (encryptedData.length > 20 && !encryptedData.startsWith('{') && !encryptedData.startsWith('[')) {
          // Looks like base64, try to decrypt
          try {
            return await this.decryptString(encryptedData);
          } catch (decryptError) {
            // Decryption failed, might be unencrypted string
            console.warn('⚠️ EncryptionService: Decryption failed, returning as-is:', decryptError);
            return encryptedData;
          }
        }
        // Regular string, return as-is
        return encryptedData;
      }
    }

    // Default: return as-is (might be unencrypted data)
    return encryptedData;
  }

  /**
   * Decrypt a base64 encrypted string
   * 
   * @param {string} encryptedBase64 - Base64 encoded encrypted data
   * @returns {Promise<any>} - Decrypted and parsed data
   */
  async decryptString(encryptedBase64) {
    if (!this.isInitialized || !this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    try {
      // Decode base64
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.encryptionKey,
        encrypted
      );
      
      // Decode JSON
      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decrypted);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn('⚠️ EncryptionService: Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Check if data is encrypted
   * 
   * @param {any} data - Data to check
   * @returns {boolean} - True if data appears to be encrypted
   */
  isEncrypted(data) {
    if (typeof data === 'object' && data.encrypted === true) {
      return true;
    }
    if (typeof data === 'string' && data.length > 20 && !data.startsWith('{') && !data.startsWith('[')) {
      // Might be encrypted base64 (long string, not JSON)
      try {
        // Try to parse as JSON first
        JSON.parse(data);
        return false; // It's JSON, not encrypted
      } catch (e) {
        // Not JSON, might be encrypted
        return true;
      }
    }
    return false;
  }

  /**
   * Encrypt sensitive fields in an object
   * Only encrypts specified fields, leaves others unchanged
   * 
   * @param {Object} obj - Object to encrypt fields in
   * @param {string[]} sensitiveFields - Array of field names to encrypt
   * @returns {Promise<Object>} - Object with encrypted fields
   */
  async encryptFields(obj, sensitiveFields) {
    if (!this.isInitialized || !this.encryptionKey) {
      return obj; // Return unencrypted if not initialized
    }

    const encryptedObj = { ...obj };
    
    for (const field of sensitiveFields) {
      if (encryptedObj[field] !== null && encryptedObj[field] !== undefined) {
        const encrypted = await this.encrypt(encryptedObj[field]);
        encryptedObj[field] = encrypted;
      }
    }
    
    // Mark as encrypted
    encryptedObj._encrypted = true;
    
    return encryptedObj;
  }

  /**
   * Decrypt sensitive fields in an object
   * 
   * @param {Object} obj - Object with encrypted fields
   * @param {string[]} sensitiveFields - Array of field names to decrypt
   * @returns {Promise<Object>} - Object with decrypted fields
   */
  async decryptFields(obj, sensitiveFields) {
    if (!obj._encrypted) {
      return obj; // Not encrypted, return as-is
    }

    if (!this.isInitialized || !this.encryptionKey) {
      console.warn('⚠️ EncryptionService: Encrypted data but encryption not initialized');
      return obj; // Return as-is (can't decrypt)
    }

    const decryptedObj = { ...obj };
    
    for (const field of sensitiveFields) {
      if (decryptedObj[field] !== null && decryptedObj[field] !== undefined) {
        try {
          decryptedObj[field] = await this.decrypt(decryptedObj[field]);
        } catch (error) {
          console.warn(`⚠️ EncryptionService: Could not decrypt field ${field}:`, error);
          // Keep encrypted value if decryption fails
        }
      }
    }
    
    // Remove encryption marker
    delete decryptedObj._encrypted;
    
    return decryptedObj;
  }

  /**
   * Generate a recovery key for password recovery
   * Recovery key is a random 256-bit key that can decrypt all encrypted data
   * 
   * @returns {Promise<string>} - Base64-encoded recovery key
   */
  async generateRecoveryKey() {
    try {
      // Generate 256-bit (32 bytes) random recovery key
      const recoveryKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const recoveryKeyBase64 = btoa(String.fromCharCode(...recoveryKeyBytes));
      return recoveryKeyBase64;
    } catch (error) {
      console.error('❌ EncryptionService: Failed to generate recovery key:', error);
      throw error;
    }
  }

  /**
   * Encrypt recovery key with platform admin master key
   * This allows platform admin to help recover data if user forgets password
   * 
   * @param {string} recoveryKeyBase64 - Base64-encoded recovery key
   * @param {string} platformMasterKey - Platform admin master key (for encrypting recovery key)
   * @returns {Promise<string>} - Encrypted recovery key (base64)
   */
  async encryptRecoveryKey(recoveryKeyBase64, platformMasterKey) {
    try {
      // Derive key from platform master key for encrypting recovery key
      const platformSalt = new Uint8Array(16).fill(0); // Use fixed salt for platform key
      const platformKey = await this.deriveKey(platformMasterKey, platformSalt);
      
      // Encrypt recovery key with platform key
      const recoveryKeyBytes = Uint8Array.from(atob(recoveryKeyBase64), c => c.charCodeAt(0));
      const encrypted = await this.encryptBytes(recoveryKeyBytes, platformKey);
      
      return encrypted;
    } catch (error) {
      console.error('❌ EncryptionService: Failed to encrypt recovery key:', error);
      throw error;
    }
  }

  /**
   * Decrypt recovery key using platform admin master key
   * 
   * @param {string} encryptedRecoveryKey - Encrypted recovery key (base64)
   * @param {string} platformMasterKey - Platform admin master key
   * @returns {Promise<string>} - Decrypted recovery key (base64)
   */
  async decryptRecoveryKey(encryptedRecoveryKey, platformMasterKey) {
    try {
      // Derive platform key
      const platformSalt = new Uint8Array(16).fill(0);
      const platformKey = await this.deriveKey(platformMasterKey, platformSalt);
      
      // Decrypt recovery key
      const recoveryKeyBytes = await this.decryptBytes(encryptedRecoveryKey, platformKey);
      const recoveryKeyBase64 = btoa(String.fromCharCode(...recoveryKeyBytes));
      
      return recoveryKeyBase64;
    } catch (error) {
      console.error('❌ EncryptionService: Failed to decrypt recovery key:', error);
      throw error;
    }
  }

  /**
   * Initialize encryption using recovery key instead of master password
   * This allows users to recover access if they forget master password
   * 
   * IMPORTANT: Recovery key decrypts the stored encryption key (wrapped with recovery key)
   * The encryption key itself is what was used to encrypt/decrypt data
   * 
   * @param {string} organizationId - Organization UUID
   * @param {string} recoveryKeyBase64 - Base64-encoded recovery key
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initializeWithRecoveryKey(organizationId, recoveryKeyBase64) {
    try {
      if (!organizationId || !recoveryKeyBase64) {
        console.warn('⚠️ EncryptionService: Missing organizationId or recoveryKey');
        return false;
      }

      this.organizationId = organizationId;

      // Get salt from Supabase
      this.salt = await this.getOrCreateSalt(organizationId);
      if (!this.salt) {
        console.warn('⚠️ EncryptionService: Could not get salt');
        return false;
      }

      // Get wrapped encryption key from Supabase
      if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
        try {
          const { data, error } = await window.supabaseClient
            .from('organizations')
            .select('settings')
            .eq('id', organizationId)
            .single();
          
          if (!error && data && data.settings && data.settings.encryption_key_wrapped) {
            // Decrypt the wrapped encryption key using recovery key
            const recoveryKeyBytes = Uint8Array.from(atob(recoveryKeyBase64), c => c.charCodeAt(0));
            
            // Derive key from recovery key for unwrapping
            const recoveryDerivedKey = await this.deriveKey(recoveryKeyBase64, this.salt);
            
            // Decrypt wrapped encryption key
            const wrappedKeyBase64 = data.settings.encryption_key_wrapped;
            const encryptionKeyBytes = await this.decryptBytes(wrappedKeyBase64, recoveryDerivedKey);
            
            // Import the decrypted encryption key
            this.encryptionKey = await crypto.subtle.importKey(
              'raw',
              encryptionKeyBytes,
              { name: this.algorithm },
              false,
              ['encrypt', 'decrypt']
            );
            
            this.isInitialized = true;
            encryptionLog('✅ EncryptionService: Initialized with recovery key (unwrapped encryption key)');
            return true;
          } else {
            console.warn('⚠️ EncryptionService: No wrapped encryption key found - recovery not available');
            return false;
          }
        } catch (err) {
          console.warn('⚠️ EncryptionService: Error retrieving wrapped encryption key:', err);
          return false;
        }
      }

      // Fallback: If no wrapped key, try deriving directly (for backward compatibility)
      // This won't work if data was encrypted with master password, but allows testing
      this.encryptionKey = await this.deriveKey(recoveryKeyBase64, this.salt);
      
      if (!this.encryptionKey) {
        console.warn('⚠️ EncryptionService: Could not derive encryption key from recovery key');
        return false;
      }

      this.isInitialized = true;
      encryptionLog('✅ EncryptionService: Initialized with recovery key (derived directly)');
      return true;
    } catch (error) {
      console.warn('⚠️ EncryptionService: Initialization with recovery key failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Wrap encryption key with recovery key for storage
   * This allows recovery key to decrypt the actual encryption key later
   * 
   * @param {string} recoveryKeyBase64 - Base64-encoded recovery key
   * @returns {Promise<string>} - Wrapped encryption key (base64)
   */
  async wrapEncryptionKeyWithRecoveryKey(recoveryKeyBase64) {
    try {
      if (!this.encryptionKey || !recoveryKeyBase64) {
        throw new Error('Encryption key or recovery key missing');
      }

      // Export encryption key to raw bytes
      const encryptionKeyBytes = await crypto.subtle.exportKey('raw', this.encryptionKey);
      
      // Derive key from recovery key for wrapping
      const recoveryDerivedKey = await this.deriveKey(recoveryKeyBase64, this.salt);
      
      // Encrypt encryption key with recovery key
      const wrapped = await this.encryptBytes(new Uint8Array(encryptionKeyBytes), recoveryDerivedKey);
      
      return wrapped;
    } catch (error) {
      console.error('❌ EncryptionService: Failed to wrap encryption key:', error);
      throw error;
    }
  }

  /**
   * Helper: Encrypt bytes with a specific key
   */
  async encryptBytes(dataBytes, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv: iv },
      key,
      dataBytes
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Helper: Decrypt bytes with a specific key
   */
  async decryptBytes(encryptedBase64, key) {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: this.algorithm, iv: iv },
      key,
      encrypted
    );
    return new Uint8Array(decrypted);
  }

  /**
   * Clear encryption key from memory (on logout)
   */
  clearKey() {
    this.encryptionKey = null;
    this.salt = null;
    this.isInitialized = false;
    this.organizationId = null;
    encryptionLog('🔒 EncryptionService: Encryption key cleared from memory');
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.encryptionService = new EncryptionService();
  encryptionLog('✅ EncryptionService: Global instance created');
}

// Export for Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EncryptionService;
}

