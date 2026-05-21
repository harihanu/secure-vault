'use strict';

/**
 * Audit Module — Encrypted audit log for tracking vault operations
 */

const Audit = (() => {
    const MAX_ENTRIES = 50;

    // ─── Log Entry ─────────────────────────────────────────────────

    function log(action, detail) {
        if (typeof App === 'undefined' || !App.state || !App.state.vault) return;

        const entry = {
            action: action,
            detail: detail,
            timestamp: new Date().toISOString()
        };

        if (!App.state.vault.auditLog) {
            App.state.vault.auditLog = [];
        }

        App.state.vault.auditLog.push(entry);

        // Trim to max entries
        while (App.state.vault.auditLog.length > MAX_ENTRIES) {
            App.state.vault.auditLog.shift();
        }
    }

    // ─── Get Log ───────────────────────────────────────────────────

    function getLog() {
        if (typeof App === 'undefined' || !App.state || !App.state.vault) {
            return [];
        }
        return App.state.vault.auditLog || [];
    }

    // ─── Clear Log ─────────────────────────────────────────────────

    function clear() {
        if (typeof App !== 'undefined' && App.state && App.state.vault) {
            App.state.vault.auditLog = [];
        }
    }

    // ─── Format Log Entry ──────────────────────────────────────────

    function formatEntry(entry) {
        const date = new Date(entry.timestamp);
        const formatted = date.toLocaleString();
        return `[${formatted}] ${entry.action}: ${entry.detail}`;
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        log,
        getLog,
        clear,
        formatEntry,
        MAX_ENTRIES
    };
})();
