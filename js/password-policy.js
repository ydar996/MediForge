/**
 * Enhanced Password Policy Module
 * Provides client-side password validation without affecting existing functionality
 * Version: 1.0
 */

const PasswordPolicy = {
    // Password requirements
    requirements: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxLength: 128,
        forbiddenPatterns: [
            /password/i,
            /123456/i,
            /qwerty/i,
            /admin/i
        ]
    },

    // Validate password against policy
    validatePassword: function(password) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            strength: 'weak'
        };

        // Check minimum length
        if (password.length < this.requirements.minLength) {
            result.isValid = false;
            result.errors.push(`Password must be at least ${this.requirements.minLength} characters long`);
        }

        // Check maximum length
        if (password.length > this.requirements.maxLength) {
            result.isValid = false;
            result.errors.push(`Password must be no more than ${this.requirements.maxLength} characters long`);
        }

        // Check for uppercase
        if (this.requirements.requireUppercase && !/[A-Z]/.test(password)) {
            result.isValid = false;
            result.errors.push('Password must contain at least one uppercase letter');
        }

        // Check for lowercase
        if (this.requirements.requireLowercase && !/[a-z]/.test(password)) {
            result.isValid = false;
            result.errors.push('Password must contain at least one lowercase letter');
        }

        // Check for numbers
        if (this.requirements.requireNumbers && !/\d/.test(password)) {
            result.isValid = false;
            result.errors.push('Password must contain at least one number');
        }

        // Check for special characters
        if (this.requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            result.isValid = false;
            result.errors.push('Password must contain at least one special character');
        }

        // Check forbidden patterns
        this.requirements.forbiddenPatterns.forEach(pattern => {
            if (pattern.test(password)) {
                result.isValid = false;
                result.errors.push('Password contains common patterns and is not secure');
            }
        });

        // Calculate password strength
        result.strength = this.calculateStrength(password);

        // Add warnings for weak passwords
        if (result.strength === 'weak' && result.isValid) {
            result.warnings.push('Password is weak. Consider using a longer, more complex password.');
        }

        return result;
    },

    // Calculate password strength
    calculateStrength: function(password) {
        let score = 0;

        // Length scoring
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;

        // Character variety scoring
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

        // Pattern detection (penalties)
        if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
        if (/123|abc|qwe/i.test(password)) score -= 1; // Sequential patterns

        // Determine strength
        if (score < 4) return 'weak';
        if (score < 6) return 'medium';
        if (score < 8) return 'strong';
        return 'very-strong';
    },

    // Generate secure password suggestions
    generateSuggestions: function() {
        const suggestions = [
            'Use a combination of uppercase and lowercase letters',
            'Include numbers and special characters',
            'Make it at least 12 characters long',
            'Avoid common words and patterns',
            'Consider using a passphrase with spaces',
            'Don\'t reuse passwords from other accounts'
        ];
        return suggestions;
    },

    // Create password strength indicator
    createStrengthIndicator: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const indicator = document.createElement('div');
        indicator.className = 'password-strength-indicator';
        indicator.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill"></div>
            </div>
            <div class="strength-text">Password strength: <span class="strength-label">Enter password</span></div>
            <div class="strength-requirements"></div>
        `;

        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .password-strength-indicator {
                margin-top: 10px;
                font-size: 0.9rem;
            }
            .strength-bar {
                width: 100%;
                height: 4px;
                background: #e9ecef;
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 5px;
            }
            .strength-fill {
                height: 100%;
                width: 0%;
                transition: all 0.3s ease;
                border-radius: 2px;
            }
            .strength-fill.weak { background: #dc3545; width: 25%; }
            .strength-fill.medium { background: #ffc107; width: 50%; }
            .strength-fill.strong { background: #28a745; width: 75%; }
            .strength-fill.very-strong { background: #007bff; width: 100%; }
            .strength-text { margin-bottom: 5px; }
            .strength-label { font-weight: 600; }
            .strength-requirements { font-size: 0.8rem; color: #666; }
            .requirement { margin: 2px 0; }
            .requirement.met { color: #28a745; }
            .requirement.unmet { color: #dc3545; }
        `;
        document.head.appendChild(style);

        container.appendChild(indicator);
        return indicator;
    },

    // Update strength indicator
    updateStrengthIndicator: function(password, indicator) {
        if (!indicator) return;

        const validation = this.validatePassword(password);
        const strengthFill = indicator.querySelector('.strength-fill');
        const strengthLabel = indicator.querySelector('.strength-label');
        const requirementsDiv = indicator.querySelector('.strength-requirements');

        // Update strength bar
        strengthFill.className = `strength-fill ${validation.strength}`;

        // Update strength text
        const strengthTexts = {
            'weak': 'Weak',
            'medium': 'Medium',
            'strong': 'Strong',
            'very-strong': 'Very Strong'
        };
        strengthLabel.textContent = strengthTexts[validation.strength] || 'Unknown';

        // Update requirements
        const requirements = [
            { text: `At least ${this.requirements.minLength} characters`, met: password.length >= this.requirements.minLength },
            { text: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
            { text: 'Contains lowercase letter', met: /[a-z]/.test(password) },
            { text: 'Contains number', met: /\d/.test(password) },
            { text: 'Contains special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
        ];

        requirementsDiv.innerHTML = requirements.map(req => 
            `<div class="requirement ${req.met ? 'met' : 'unmet'}">${req.met ? '✓' : '✗'} ${req.text}</div>`
        ).join('');
    },

    // Enhance existing password inputs
    enhancePasswordInputs: function() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        
        passwordInputs.forEach(input => {
            // Skip if already enhanced
            if (input.dataset.passwordEnhanced) return;
            
            // Create container for strength indicator
            const container = document.createElement('div');
            container.id = `password-strength-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            input.parentNode.insertBefore(container, input.nextSibling);
            
            // Create strength indicator
            const indicator = this.createStrengthIndicator(container.id);
            
            // Add event listener
            input.addEventListener('input', (e) => {
                this.updateStrengthIndicator(e.target.value, indicator);
            });
            
            // Mark as enhanced
            input.dataset.passwordEnhanced = 'true';
        });
    }
};

// Auto-enhance password inputs when DOM is ready
if (typeof window !== 'undefined') {
    window.PasswordPolicy = PasswordPolicy;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            PasswordPolicy.enhancePasswordInputs();
        });
    } else {
        PasswordPolicy.enhancePasswordInputs();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordPolicy;
}






