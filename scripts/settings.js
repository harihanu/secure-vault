'use strict';

/**
 * Settings Module — Manage vault settings persistence
 */

const Settings = (() => {

    const DEFAULTS = {
        autoLockMinutes: 5,
        clipboardClearSeconds: 30,
        lockOnTabHidden: true,
        totpEnabled: false,
        totpSecret: '',
        recoveryCodes: [],
        viewMode: 'grid',
        sortBy: 'updatedAt',
        sortOrder: 'desc'
    };

    // ─── Get Settings ──────────────────────────────────────────────

    function get() {
        if (typeof App !== 'undefined' && App.state && App.state.vault) {
            return { ...DEFAULTS, ...(App.state.vault.settings || {}) };
        }
        return { ...DEFAULTS };
    }

    // ─── Update Settings ───────────────────────────────────────────

    function update(newSettings) {
        if (typeof App !== 'undefined' && App.state && App.state.vault) {
            App.state.vault.settings = { ...get(), ...newSettings };
        }
    }

    // ─── UI Sync ───────────────────────────────────────────────────

    function syncToUI() {
        const settings = get();

        const autolock = document.getElementById('setting-autolock');
        const autolockValue = document.getElementById('autolock-value');
        const clipboard = document.getElementById('setting-clipboard');
        const clipboardValue = document.getElementById('clipboard-value');
        const lockOnTab = document.getElementById('setting-lockontab');

        if (autolock) autolock.value = settings.autoLockMinutes;
        if (autolockValue) autolockValue.textContent = settings.autoLockMinutes;
        if (clipboard) clipboard.value = settings.clipboardClearSeconds;
        if (clipboardValue) clipboardValue.textContent = settings.clipboardClearSeconds;
        if (lockOnTab) lockOnTab.checked = settings.lockOnTabHidden;

        // Update TOTP status
        updateTOTPStatus(settings);
    }

    function syncFromUI() {
        const autolock = document.getElementById('setting-autolock');
        const clipboard = document.getElementById('setting-clipboard');
        const lockOnTab = document.getElementById('setting-lockontab');

        update({
            autoLockMinutes: parseInt(autolock?.value || 5),
            clipboardClearSeconds: parseInt(clipboard?.value || 30),
            lockOnTabHidden: lockOnTab?.checked !== false
        });
    }

    function updateTOTPStatus(settings) {
        const statusEl = document.getElementById('totp-status');
        if (!statusEl) return;

        if (settings.totpEnabled) {
            statusEl.innerHTML = `
                <p style="color:var(--success);margin-bottom:12px;">✅ 2FA is enabled.</p>
                <button class="btn btn-danger btn-sm" id="btn-disable-totp">Disable 2FA</button>
            `;
        } else {
            statusEl.innerHTML = `
                <p style="color:var(--text-secondary);margin-bottom:12px;">2FA is not enabled.</p>
                <button class="btn btn-secondary btn-sm" id="btn-setup-totp">Setup 2FA</button>
            `;
        }
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        get,
        update,
        syncToUI,
        syncFromUI,
        DEFAULTS
    };
})();
