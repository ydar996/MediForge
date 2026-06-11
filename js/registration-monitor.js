/**
 * Registration Monitoring and Health Check
 * Tracks registration success/failure rates and detects issues
 */

class RegistrationMonitor {
  constructor() {
    this.metrics = {
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      failuresByType: {},
      lastFailure: null,
      lastSuccess: null
    };
    this.loadMetrics();
  }

  loadMetrics() {
    try {
      const stored = localStorage.getItem('registration_metrics');
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Could not load registration metrics:', e);
    }
  }

  saveMetrics() {
    try {
      localStorage.setItem('registration_metrics', JSON.stringify(this.metrics));
    } catch (e) {
      console.warn('Could not save registration metrics:', e);
    }
  }

  recordAttempt(success, errorType = null, errorMessage = null) {
    this.metrics.totalAttempts++;
    
    if (success) {
      this.metrics.successful++;
      this.metrics.lastSuccess = new Date().toISOString();
    } else {
      this.metrics.failed++;
      this.metrics.lastFailure = {
        timestamp: new Date().toISOString(),
        type: errorType,
        message: errorMessage
      };
      
      if (errorType) {
        this.metrics.failuresByType[errorType] = 
          (this.metrics.failuresByType[errorType] || 0) + 1;
      }
    }
    
    this.saveMetrics();
    this.checkHealth();
  }

  checkHealth() {
    const successRate = this.metrics.totalAttempts > 0 
      ? (this.metrics.successful / this.metrics.totalAttempts) * 100 
      : 100;

    // Alert if success rate drops below 80%
    if (this.metrics.totalAttempts >= 10 && successRate < 80) {
      console.warn('⚠️ Registration success rate below 80%:', successRate.toFixed(1) + '%');
      console.warn('Failure breakdown:', this.metrics.failuresByType);
      
      // Could send alert to admin here
      if (typeof logAuditEvent !== 'undefined') {
        logAuditEvent('registration_health_warning', {
          successRate: successRate.toFixed(1),
          totalAttempts: this.metrics.totalAttempts,
          failuresByType: this.metrics.failuresByType
        });
      }
    }

    return {
      healthy: successRate >= 80,
      successRate: successRate.toFixed(1),
      metrics: this.metrics
    };
  }

  getReport() {
    const successRate = this.metrics.totalAttempts > 0 
      ? (this.metrics.successful / this.metrics.totalAttempts) * 100 
      : 0;

    return {
      summary: {
        totalAttempts: this.metrics.totalAttempts,
        successful: this.metrics.successful,
        failed: this.metrics.failed,
        successRate: successRate.toFixed(1) + '%',
        healthy: successRate >= 80
      },
      failuresByType: this.metrics.failuresByType,
      lastFailure: this.metrics.lastFailure,
      lastSuccess: this.metrics.lastSuccess
    };
  }

  reset() {
    this.metrics = {
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      failuresByType: {},
      lastFailure: null,
      lastSuccess: null
    };
    this.saveMetrics();
  }
}

// Initialize global monitor
if (typeof window !== 'undefined') {
  window.registrationMonitor = new RegistrationMonitor();
  
  // Hook into registration function
  const originalRegister = window.registerWithSupabase;
  if (originalRegister) {
    window.registerWithSupabase = async function(userData) {
      try {
        const result = await originalRegister.call(this, userData);
        
        if (result.success) {
          window.registrationMonitor.recordAttempt(true);
        } else {
          // Categorize error type
          let errorType = 'unknown';
          const errorMsg = result.error || '';
          
          if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('fetch')) {
            errorType = 'network';
          } else if (errorMsg.includes('already registered') || errorMsg.includes('duplicate')) {
            errorType = 'duplicate';
          } else if (errorMsg.includes('organization') || errorMsg.includes('foreign key')) {
            errorType = 'organization';
          } else if (errorMsg.includes('RLS') || errorMsg.includes('permission')) {
            errorType = 'permission';
          } else if (errorMsg.includes('email') || errorMsg.includes('column')) {
            errorType = 'schema';
          } else if (errorMsg.includes('password')) {
            errorType = 'password';
          }
          
          window.registrationMonitor.recordAttempt(false, errorType, errorMsg);
        }
        
        return result;
      } catch (error) {
        window.registrationMonitor.recordAttempt(false, 'exception', error.message);
        throw error;
      }
    };
  }
}






