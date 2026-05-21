'use strict';

/**
 * Validators Module — Input sanitization, schema validation, entry validation
 */

const Validators = (() => {

    // ─── Input Sanitization ────────────────────────────────────────

    function sanitizeInput(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/<[^>]*>/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    function sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeInput(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item =>
                    typeof item === 'string' ? sanitizeInput(item) : item
                );
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    // ─── Schema Validation ─────────────────────────────────────────

    const VAULT_SCHEMA = {
        required: ['entries', 'settings', 'auditLog'],
        entryRequired: ['id', 'category', 'title', 'createdAt', 'updatedAt'],
        validCategories: [
            'passwords', 'apikeys', 'bank', 'cards', 'notes',
            'identities', 'licenses', 'sshkeys', 'recovery', 'custom'
        ]
    };

    function validateVaultSchema(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid vault data structure' };
        }

        for (const field of VAULT_SCHEMA.required) {
            if (!(field in data)) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }

        if (!Array.isArray(data.entries)) {
            return { valid: false, error: 'Entries must be an array' };
        }

        if (!Array.isArray(data.auditLog)) {
            return { valid: false, error: 'Audit log must be an array' };
        }

        if (!data.settings || typeof data.settings !== 'object') {
            return { valid: false, error: 'Settings must be an object' };
        }

        return { valid: true };
    }

    function validateEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return { valid: false, error: 'Invalid entry data' };
        }

        for (const field of VAULT_SCHEMA.entryRequired) {
            if (!(field in entry) || !entry[field]) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }

        if (!VAULT_SCHEMA.validCategories.includes(entry.category)) {
            return { valid: false, error: `Invalid category: ${entry.category}` };
        }

        return { valid: true };
    }

    function validateEnvelope(envelope) {
        if (!envelope || typeof envelope !== 'object') {
            return { valid: false, error: 'Invalid vault file format' };
        }

        const required = ['encrypted', 'iv', 'salt', 'version'];
        for (const field of required) {
            if (!(field in envelope)) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }

        return { valid: true };
    }

    // ─── Entry Factory ─────────────────────────────────────────────

    function createEmptyEntry(category) {
        const now = new Date().toISOString();
        const base = {
            id: '',
            category: category,
            title: '',
            notes: '',
            tags: [],
            favorite: false,
            createdAt: now,
            updatedAt: now
        };

        switch (category) {
            case 'passwords':
                return { ...base, username: '', password: '', url: '', totpSecret: '' };
            case 'apikeys':
                return { ...base, service: '', apiKey: '', endpoint: '' };
            case 'bank':
                return { ...base, bankName: '', accountNumber: '', routingNumber: '', iban: '', swift: '' };
            case 'cards':
                return { ...base, cardNumber: '', cardExpiry: '', cvv: '', cardHolder: '', cardType: '' };
            case 'notes':
                return { ...base, content: '' };
            case 'identities':
                return { ...base, fullName: '', email: '', phone: '', address: '', dateOfBirth: '' };
            case 'licenses':
                return { ...base, product: '', licenseKey: '', expiryDate: '', purchaseDate: '' };
            case 'sshkeys':
                return { ...base, host: '', publicKey: '', privateKey: '', passphrase: '' };
            case 'recovery':
                return { ...base, service: '', codes: '' };
            case 'custom':
                return { ...base, fields: [] };
            default:
                return base;
        }
    }

    // ─── Password Validation ───────────────────────────────────────

    function validatePassword(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
            noRepeats: !/(.)\1{2,}/.test(password)
        };

        let score = 0;
        if (checks.length) score += 1;
        if (password.length >= 12) score += 0.5;
        if (password.length >= 16) score += 0.5;
        if (checks.uppercase) score += 0.5;
        if (checks.lowercase) score += 0.5;
        if (checks.number) score += 0.5;
        if (checks.special) score += 1;
        if (checks.noRepeats) score += 0.5;

        let label, color;
        if (score < 2) { label = 'Weak'; color = '#ef4444'; }
        else if (score < 3) { label = 'Fair'; color = '#f59e0b'; }
        else if (score < 4) { label = 'Good'; color = '#eab308'; }
        else { label = 'Strong'; color = '#22c55e'; }

        return {
            score: Math.min(4, Math.round(score)),
            label,
            color,
            checks,
            isWeak: score < 2
        };
    }

    // ─── Email Validation ──────────────────────────────────────────

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ─── URL Validation ────────────────────────────────────────────

    function validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        sanitizeInput,
        sanitizeObject,
        validateVaultSchema,
        validateEntry,
        validateEnvelope,
        createEmptyEntry,
        validatePassword,
        validateEmail,
        validateURL,
        VAULT_SCHEMA
    };
})();
