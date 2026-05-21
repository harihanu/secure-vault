'use strict';

/**
 * Session Module — Auto-lock, panic lock, privacy shield, activity monitoring
 */

const Session = (() => {
    let autoLockTimer = null;
    let clipboardTimer = null;
    let lastActivity = Date.now();
    let isLocked = true;
    let escCount = 0;
    let escTimer = null;
    let onLockCallback = null;

    const DEFAULTS = {
        autoLockMinutes: 5,
        clipboardClearSeconds: 30
    };

    // ─── Activity Monitoring ───────────────────────────────────────

    function resetAutoLock() {
        if (isLocked) return;

        lastActivity = Date.now();

        if (autoLockTimer) {
            clearTimeout(autoLockTimer);
        }

        const settings = App?.state?.vault?.settings || {};
        const minutes = settings.autoLockMinutes || DEFAULTS.autoLockMinutes;

        autoLockTimer = setTimeout(() => {
            lockVault('inactivity');
        }, minutes * 60 * 1000);
    }

    function startActivityMonitor() {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetAutoLock, { passive: true });
        });

        // Lock on tab hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !isLocked) {
                const settings = App?.state?.vault?.settings || {};
                if (settings.lockOnTabHidden !== false) {
                    lockVault('tab_hidden');
                }
            }
        });

        // Lock on window blur (optional privacy shield)
        window.addEventListener('blur', () => {
            if (!isLocked) {
                applyPrivacyShield();
            }
        });

        window.addEventListener('focus', () => {
            removePrivacyShield();
            resetAutoLock();
        });

        // Lock on sleep/wake
        let lastTime = Date.now();
        setInterval(() => {
            const now = Date.now();
            if (now - lastTime > 30000 && !isLocked) {
                lockVault('sleep_detected');
            }
            lastTime = now;
        }, 5000);
    }

    // ─── Privacy Shield ────────────────────────────────────────────

    function applyPrivacyShield() {
        document.body.classList.add('privacy-shield');
    }

    function removePrivacyShield() {
        document.body.classList.remove('privacy-shield');
    }

    // ─── Panic Lock (Triple Esc or Ctrl+Shift+L) ──────────────────

    function handlePanicShortcut(e) {
        // Ctrl+Shift+L
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            lockVault('panic');
            return;
        }

        // Triple Esc
        if (e.key === 'Escape') {
            if (escTimer) clearTimeout(escTimer);
            escCount++;

            if (escCount >= 3) {
                escCount = 0;
                lockVault('panic');
                return;
            }

            escTimer = setTimeout(() => { escCount = 0; }, 1000);
        }
    }

    // ─── Lock Vault ────────────────────────────────────────────────

    function lockVault(reason = 'manual') {
        isLocked = true;

        // Clear timers
        if (autoLockTimer) {
            clearTimeout(autoLockTimer);
            autoLockTimer = null;
        }
        if (clipboardTimer) {
            clearTimeout(clipboardTimer);
            clipboardTimer = null;
        }

        // Clear clipboard
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('');
            }
        } catch {
            // Clipboard API may not be available
        }

        // Remove privacy shield
        removePrivacyShield();

        // Clear sensitive state in App
        if (typeof App !== 'undefined' && App.clearSensitiveState) {
            App.clearSensitiveState();
        }

        // Clear search index
        if (typeof Search !== 'undefined' && Search.destroy) {
            Search.destroy();
        }

        // Callback
        if (onLockCallback) {
            onLockCallback(reason);
        }
    }

    // ─── Clipboard Management ──────────────────────────────────────

    async function copyToClipboard(text, fieldName = 'Value') {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for file:// or restricted contexts
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.cssText = 'position:fixed;opacity:0;left:-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            const settings = App?.state?.vault?.settings || {};
            const seconds = settings.clipboardClearSeconds || DEFAULTS.clipboardClearSeconds;

            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(`${fieldName} copied. Clears in ${seconds}s.`, 'info');
            }

            // Auto-clear
            if (clipboardTimer) clearTimeout(clipboardTimer);
            clipboardTimer = setTimeout(() => {
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText('');
                    }
                } catch { /* ignore */ }
            }, seconds * 1000);

            return true;
        } catch (error) {
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Failed to copy to clipboard', 'error');
            }
            return false;
        }
    }

    // ─── Session Lifecycle ─────────────────────────────────────────

    function unlock() {
        isLocked = false;
        resetAutoLock();
        if (typeof Audit !== 'undefined' && Audit.log) {
            Audit.log('vault_unlocked', 'Vault unlocked');
        }
    }

    function onLock(callback) {
        onLockCallback = callback;
    }

    function getIsLocked() {
        return isLocked;
    }

    // ─── Initialization ────────────────────────────────────────────

    function init() {
        document.addEventListener('keydown', handlePanicShortcut);
        startActivityMonitor();
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        init,
        lockVault,
        unlock,
        onLock,
        getIsLocked,
        copyToClipboard,
        resetAutoLock,
        applyPrivacyShield,
        removePrivacyShield,
        DEFAULTS
    };
})();
