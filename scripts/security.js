'use strict';

/**
 * Security Module — Brute force protection, input sanitization, CSP enforcement
 */

const Security = (() => {
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY = 60000; // 60 seconds
    const LOCKOUT_KEY = 'vault_lockout';

    let failedAttempts = 0;
    let lockoutUntil = 0;

    // ─── Brute Force Protection ────────────────────────────────────

    function getLockoutState() {
        try {
            const stored = localStorage.getItem(LOCKOUT_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                lockoutUntil = data.lockoutUntil || 0;
                failedAttempts = data.failedAttempts || 0;
            }
        } catch {
            // Ignore parse errors
        }
    }

    function saveLockoutState() {
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify({
            failedAttempts,
            lockoutUntil
        }));
    }

    function recordFailedAttempt() {
        getLockoutState();
        failedAttempts++;

        if (failedAttempts >= MAX_ATTEMPTS) {
            const extraAttempts = failedAttempts - MAX_ATTEMPTS;
            const delay = BASE_DELAY * Math.pow(2, extraAttempts);
            lockoutUntil = Date.now() + delay;
        }

        saveLockoutState();
    }

    function resetAttempts() {
        failedAttempts = 0;
        lockoutUntil = 0;
        localStorage.removeItem(LOCKOUT_KEY);
    }

    function isLockedOut() {
        getLockoutState();
        if (lockoutUntil > Date.now()) {
            return {
                locked: true,
                remainingMs: lockoutUntil - Date.now(),
                remainingSeconds: Math.ceil((lockoutUntil - Date.now()) / 1000)
            };
        }
        return { locked: false };
    }

    function getRemainingDelay() {
        const lockout = isLockedOut();
        if (lockout.locked) {
            return lockout.remainingSeconds;
        }
        return 0;
    }

    // ─── Input Sanitization (delegates to Validators) ──────────────

    function sanitize(str) {
        return Validators.sanitizeInput(str);
    }

    function sanitizeAll(obj) {
        return Validators.sanitizeObject(obj);
    }

    // ─── CSP Headers (meta tag enforcement) ────────────────────────

    function enforceCSP() {
        // Skip CSP on file:// — it causes more problems than it solves
        if (location.protocol === 'file:') return;

        if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            // Note: frame-ancestors can only be enforced via HTTP header, not meta tag
            meta.content = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
                "base-uri 'self'",
                "form-action 'self'"
            ].join('; ');
            document.head.appendChild(meta);
        }
    }

    // ─── Permission Policy ─────────────────────────────────────────

    function enforcePermissionsPolicy() {
        if (location.protocol === 'file:') return;
        if (!document.querySelector('meta[http-equiv="Permissions-Policy"]')) {
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Permissions-Policy';
            meta.content = 'camera=(), microphone=(), geolocation=(), payment=()';
            document.head.appendChild(meta);
        }
    }

    // ─── Security Initialization ───────────────────────────────────

    function init() {
        enforceCSP();
        enforcePermissionsPolicy();
        getLockoutState();
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        init,
        recordFailedAttempt,
        resetAttempts,
        isLockedOut,
        getRemainingDelay,
        sanitize,
        sanitizeAll
    };
})();
