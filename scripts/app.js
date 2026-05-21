'use strict';

/**
 * App Module — Main orchestrator for the Secure Vault application
 */

const App = (() => {
    const state = {
        vault: null,
        masterPassword: null,
        salt: null,
        currentView: 'all',
        searchQuery: '',
        selectedEntryId: null,
        isFirstTime: false,
        pendingTOTPSecret: null,
        pendingRecoveryCodes: null
    };

    // ─── Initialization ────────────────────────────────────────────

    async function init() {
        try {
            Security.init();
            Vault.init();
            Session.init();
            Session.onLock(handleLock);

            state.isFirstTime = !(await Vault.vaultExists());

            renderLockScreen();
            attachEventListeners();
        } catch (error) {
            console.error('Init error:', error);
            // Still attach listeners even if something fails
            try { attachEventListeners(); } catch(e) { console.error('Listener error:', e); }
        }
    }

    // ─── Lock Screen ───────────────────────────────────────────────

    function renderLockScreen() {
        const hint = document.getElementById('first-time-hint');
        const btn = document.getElementById('unlock-btn');
        const totpGroup = document.getElementById('totp-group');

        if (state.isFirstTime) {
            hint.classList.remove('hidden');
            btn.textContent = 'Create Vault';
            totpGroup.classList.add('hidden');
        } else {
            hint.classList.add('hidden');
            btn.textContent = 'Unlock Vault';
        }

        document.getElementById('master-password').value = '';
        document.getElementById('totp-code').value = '';
        document.getElementById('lock-error').textContent = '';
        document.getElementById('strength-bar').classList.add('hidden');

        showScreen('lock-screen');
    }

    function showScreen(screenId) {
        document.getElementById('lock-screen').style.display = screenId === 'lock-screen' ? '' : 'none';
        const dashboard = document.getElementById('dashboard');
        if (screenId === 'dashboard') {
            dashboard.classList.add('active');
        } else {
            dashboard.classList.remove('active');
        }
    }

    // ─── Authentication ────────────────────────────────────────────

    async function handleLogin(password) {
        const errorEl = document.getElementById('lock-error');
        const lockCard = document.getElementById('lock-card');

        password = (password || '').trim();

        if (!password) {
            errorEl.textContent = 'Please enter your master password.';
            return;
        }

        if (password.length < 4) {
            errorEl.textContent = 'Password must be at least 4 characters.';
            return;
        }

        // Check brute force
        const lockout = Security.isLockedOut();
        if (lockout.locked) {
            errorEl.textContent = `Too many attempts. Try again in ${lockout.remainingSeconds}s.`;
            return;
        }

        if (state.isFirstTime) {
            await createVault(password);
        } else {
            await unlockVault(password);
        }
    }

    async function createVault(password) {
        const errorEl = document.getElementById('lock-error');

        // Check password strength
        const strength = PasswordGenerator.evaluateStrength(password);
        if (strength.score < 2) {
            const proceed = await showConfirm(
                '⚠️ Weak Password',
                'Your master password is weak. Consider using 12+ characters with mixed types. Continue anyway?',
                'Continue',
                'Go Back'
            );
            if (!proceed) return;
        }

        try {
            const vaultData = {
                entries: [],
                settings: { ...Settings.DEFAULTS },
                auditLog: []
            };

            const envelope = await Vault.createVault(vaultData, password);
            state.vault = vaultData;
            state.masterPassword = password;
            state.salt = envelope.salt;

            Security.resetAttempts();
            Session.unlock();
            Audit.log('vault_created', 'Vault created');

            renderDashboard();
            showScreen('dashboard');
            UI.showToast('Vault created successfully!', 'success');
        } catch (error) {
            errorEl.textContent = 'Failed to create vault: ' + error.message;
        }
    }

    async function unlockVault(password) {
        const errorEl = document.getElementById('lock-error');
        const lockCard = document.getElementById('lock-card');

        try {
            const result = await Vault.loadVault(password);
            state.vault = result.data;
            state.masterPassword = password;
            state.salt = result.envelope.salt;

            // Check if 2FA is enabled
            if (state.vault.settings?.totpEnabled && state.vault.settings?.totpSecret) {
                const totpGroup = document.getElementById('totp-group');
                const totpInput = document.getElementById('totp-code');

                if (!totpInput.value) {
                    totpGroup.classList.remove('hidden');
                    totpInput.focus();
                    errorEl.textContent = '';
                    return;
                }

                // Verify TOTP
                const valid = await Vault.verifyTOTP(state.vault.settings.totpSecret, totpInput.value);
                if (!valid) {
                    errorEl.textContent = 'Invalid 2FA code.';
                    Security.recordFailedAttempt();
                    lockCard.classList.add('shake');
                    setTimeout(() => lockCard.classList.remove('shake'), 500);
                    return;
                }
            }

            Security.resetAttempts();
            Session.unlock();
            Audit.log('vault_unlocked', 'Vault unlocked');

            renderDashboard();
            showScreen('dashboard');
            UI.showToast('Vault unlocked', 'success');
        } catch (error) {
            errorEl.textContent = 'Incorrect master password.';
            Security.recordFailedAttempt();
            lockCard.classList.add('shake');
            setTimeout(() => lockCard.classList.remove('shake'), 500);
        }
    }

    // ─── Dashboard Rendering ───────────────────────────────────────

    function renderDashboard() {
        UI.renderSidebar();
        UI.renderEntries();
        UI.renderStats();
    }

    // ─── Clear Sensitive State ─────────────────────────────────────

    function clearSensitiveState() {
        if (state.masterPassword) {
            state.masterPassword = null;
        }
        state.vault = null;
        state.salt = null;
        state.selectedEntryId = null;
        state.searchQuery = '';
        state.pendingTOTPSecret = null;
        state.pendingRecoveryCodes = null;
    }

    // ─── Lock Handler ──────────────────────────────────────────────

    function handleLock(reason) {
        clearSensitiveState();
        renderLockScreen();
        showScreen('lock-screen');

        if (reason === 'panic') {
            UI.showToast('Vault locked (panic)', 'warning');
        } else if (reason === 'inactivity') {
            UI.showToast('Vault locked due to inactivity', 'info');
        }
    }

    // ─── Entry CRUD ────────────────────────────────────────────────

    async function saveEntry(data) {
        if (!state.vault) {
            UI.showToast('No vault loaded', 'error');
            return;
        }

        try {
        const sanitized = Validators.sanitizeObject(data);

        if (UI.getCurrentEditId()) {
            // Update
            const index = state.vault.entries.findIndex(e => e.id === UI.getCurrentEditId());
            if (index !== -1) {
                state.vault.entries[index] = {
                    ...state.vault.entries[index],
                    ...sanitized,
                    updatedAt: new Date().toISOString()
                };
                Audit.log('entry_updated', `Updated: ${sanitized.title}`);
                UI.showToast('Entry updated', 'success');
            }
        } else {
            // Create
            const id = await Vault.generateId();
            state.vault.entries.push({
                ...sanitized,
                id: id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            Audit.log('entry_created', `Created: ${sanitized.title}`);
            UI.showToast('Entry created', 'success');
        }

        await saveVaultState();
        renderDashboard();
        UI.closeModal('edit-modal');
        } catch (error) {
            UI.showToast('Failed to save: ' + error.message, 'error');
            console.error('Save error:', error);
        }
    }

    async function deleteEntry(id) {
        if (!state.vault) return;

        const entry = state.vault.entries.find(e => e.id === id);
        if (!entry) return;

        const confirmed = await showConfirm(
            '🗑️ Delete Entry',
            `Delete "${entry.title}"? This cannot be undone.`,
            'Delete',
            'Cancel'
        );

        if (!confirmed) return;

        state.vault.entries = state.vault.entries.filter(e => e.id !== id);
        Audit.log('entry_deleted', `Deleted: ${entry.title}`);

        await saveVaultState();
        renderDashboard();
        UI.closeModal('detail-modal');
        UI.showToast('Entry deleted', 'success');
    }

    async function toggleFavorite(id) {
        if (!state.vault) return;

        const entry = state.vault.entries.find(e => e.id === id);
        if (entry) {
            entry.favorite = !entry.favorite;
            entry.updatedAt = new Date().toISOString();
            await saveVaultState();
            renderDashboard();
        }
    }

    async function saveVaultState() {
        if (!state.vault || !state.masterPassword) return;

        try {
            const envelope = await Vault.saveVault(state.vault, state.masterPassword, state.salt);
            state.salt = envelope.salt;
        } catch (error) {
            UI.showToast('Failed to save vault: ' + error.message, 'error');
        }
    }

    // ─── TOTP Setup ────────────────────────────────────────────────

    async function setupTOTP() {
        try {
            const secret = await Vault.generateTOTPSecret();
            const codes = await Vault.generateRecoveryCodes(8);

            state.pendingTOTPSecret = secret;
            state.pendingRecoveryCodes = codes;

            document.getElementById('totp-secret-display').textContent = secret;
            document.getElementById('recovery-codes-display').innerHTML = codes.map(c =>
                `<div style="padding:4px 0;">${c}</div>`
            ).join('');
            document.getElementById('totp-verify-code').value = '';

            UI.openModal('totp-modal');
        } catch (error) {
            UI.showToast('Failed to setup 2FA: ' + error.message, 'error');
        }
    }

    async function confirmTOTP() {
        const code = document.getElementById('totp-verify-code').value.trim();

        if (!code || code.length !== 6) {
            UI.showToast('Enter a 6-digit code', 'error');
            return;
        }

        try {
            const valid = await Vault.verifyTOTP(state.pendingTOTPSecret, code);
            if (!valid) {
                UI.showToast('Invalid code. Try again.', 'error');
                return;
            }

            Settings.update({
                totpEnabled: true,
                totpSecret: state.pendingTOTPSecret,
                recoveryCodes: state.pendingRecoveryCodes
            });

            await saveVaultState();
            UI.closeModal('totp-modal');
            UI.showToast('2FA enabled successfully!', 'success');
            Settings.syncToUI();
        } catch (error) {
            UI.showToast('Verification failed: ' + error.message, 'error');
        }
    }

    async function disableTOTP() {
        const confirmed = await showConfirm(
            '🔓 Disable 2FA',
            'Are you sure you want to disable two-factor authentication?',
            'Disable',
            'Cancel'
        );

        if (!confirmed) return;

        Settings.update({
            totpEnabled: false,
            totpSecret: '',
            recoveryCodes: []
        });

        await saveVaultState();
        UI.showToast('2FA disabled', 'success');
        Settings.syncToUI();
    }

    // ─── Confirm Dialog ────────────────────────────────────────────

    function showConfirm(title, message, okText = 'Confirm', cancelText = 'Cancel') {
        return new Promise(resolve => {
            document.getElementById('confirm-icon').textContent = title.split(' ')[0];
            document.getElementById('confirm-title').textContent = title.replace(/^[^\s]+\s/, '');
            document.getElementById('confirm-message').textContent = message;
            document.getElementById('confirm-ok').textContent = okText;

            UI.openModal('confirm-modal');

            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');

            const cleanup = () => {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                UI.closeModal('confirm-modal');
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    // ─── Open Add Modal ────────────────────────────────────────────

    function openAddModal() {
        UI.openEditModal(null);
    }

    // ─── Event Listeners ───────────────────────────────────────────

    function attachEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin(document.getElementById('master-password').value);
        });

        // Password toggle
        document.getElementById('toggle-password').addEventListener('click', () => {
            const input = document.getElementById('master-password');
            const btn = document.getElementById('toggle-password');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });

        // Password strength on lock screen
        document.getElementById('master-password').addEventListener('input', (e) => {
            const password = e.target.value;
            const bar = document.getElementById('strength-bar');
            const segments = document.getElementById('strength-segments');
            const label = document.getElementById('strength-label');

            if (state.isFirstTime && password) {
                bar.classList.remove('hidden');
                const strength = PasswordGenerator.evaluateStrength(password);
                segments.innerHTML = '';
                for (let i = 0; i < 4; i++) {
                    const seg = document.createElement('div');
                    seg.className = 'strength-segment';
                    if (i <= strength.score) seg.style.background = strength.color;
                    segments.appendChild(seg);
                }
                label.textContent = strength.label;
                label.style.color = strength.color;
            } else {
                bar.classList.add('hidden');
            }
        });

        // TOTP code enter
        document.getElementById('totp-code').addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                await handleLogin(document.getElementById('master-password').value);
            }
        });

        // Sidebar navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                state.currentView = item.dataset.view;
                state.searchQuery = '';
                document.getElementById('search-input').value = '';
                renderDashboard();

                // Close mobile sidebar
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebar-backdrop').classList.remove('active');
            });
        });

        // Hamburger menu
        document.getElementById('hamburger').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-backdrop').classList.toggle('active');
        });

        document.getElementById('sidebar-backdrop').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-backdrop').classList.remove('active');
        });

        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            UI.renderEntries();
        });

        // View toggle
        document.getElementById('view-grid').addEventListener('click', () => {
            Settings.update({ viewMode: 'grid' });
            document.getElementById('view-grid').classList.add('active');
            document.getElementById('view-list').classList.remove('active');
            UI.renderEntries();
        });

        document.getElementById('view-list').addEventListener('click', () => {
            Settings.update({ viewMode: 'list' });
            document.getElementById('view-list').classList.add('active');
            document.getElementById('view-grid').classList.remove('active');
            UI.renderEntries();
        });

        // Add entry
        document.getElementById('btn-add').addEventListener('click', openAddModal);

        // Export
        document.getElementById('btn-export').addEventListener('click', () => Backup.exportVault());

        // Import
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').value = '';
            document.getElementById('import-password').value = '';
            UI.openModal('import-modal');
        });

        document.getElementById('import-confirm').addEventListener('click', async () => {
            const file = document.getElementById('import-file').files[0];
            const password = document.getElementById('import-password').value;
            const mode = document.querySelector('input[name="import-mode"]:checked').value;

            if (!file) { UI.showToast('Select a file', 'error'); return; }
            if (!password) { UI.showToast('Enter the vault password', 'error'); return; }

            const success = await Backup.importVault(file, mode, password);
            if (success) UI.closeModal('import-modal');
        });

        document.getElementById('import-cancel').addEventListener('click', () => UI.closeModal('import-modal'));
        document.getElementById('import-close').addEventListener('click', () => UI.closeModal('import-modal'));

        // Health dashboard
        document.getElementById('btn-health').addEventListener('click', () => UI.showHealthDashboard());
        document.getElementById('health-close').addEventListener('click', () => UI.closeModal('health-modal'));
        document.getElementById('health-close-btn').addEventListener('click', () => UI.closeModal('health-modal'));

        // Audit log
        document.getElementById('btn-audit').addEventListener('click', () => {
            UI.renderAuditLog();
            UI.openModal('settings-modal');
        });

        // Lock vault
        document.getElementById('btn-lock').addEventListener('click', () => Session.lockVault('manual'));

        // Settings
        document.getElementById('btn-settings').addEventListener('click', () => {
            Settings.syncToUI();
            UI.renderAuditLog();
            UI.openModal('settings-modal');
        });

        document.getElementById('settings-close').addEventListener('click', () => UI.closeModal('settings-modal'));

        document.getElementById('settings-save').addEventListener('click', async () => {
            Settings.syncFromUI();
            await saveVaultState();
            UI.closeModal('settings-modal');
            UI.showToast('Settings saved', 'success');
        });

        // Settings sliders
        document.getElementById('setting-autolock').addEventListener('input', (e) => {
            document.getElementById('autolock-value').textContent = e.target.value;
        });

        document.getElementById('setting-clipboard').addEventListener('input', (e) => {
            document.getElementById('clipboard-value').textContent = e.target.value;
        });

        // TOTP setup from settings
        document.getElementById('btn-setup-totp')?.addEventListener('click', setupTOTP);
        document.getElementById('btn-disable-totp')?.addEventListener('click', disableTOTP);

        document.getElementById('totp-confirm').addEventListener('click', confirmTOTP);
        document.getElementById('totp-cancel').addEventListener('click', () => UI.closeModal('totp-modal'));
        document.getElementById('totp-close').addEventListener('click', () => UI.closeModal('totp-modal'));

        document.getElementById('copy-totp-secret').addEventListener('click', () => {
            Session.copyToClipboard(state.pendingTOTPSecret, 'TOTP Secret');
        });

        // Settings export/import
        document.getElementById('btn-settings-export').addEventListener('click', () => Backup.exportVault());
        document.getElementById('btn-settings-import').addEventListener('click', () => {
            UI.closeModal('settings-modal');
            document.getElementById('import-file').value = '';
            document.getElementById('import-password').value = '';
            UI.openModal('import-modal');
        });

        // Delete all data
        document.getElementById('btn-delete-all').addEventListener('click', async () => {
            const confirmed = await showConfirm(
                '⚠️ Delete Everything',
                'This will permanently delete your vault and all data. You will need to create a new vault. This cannot be undone.',
                'Delete Everything',
                'Cancel'
            );

            if (confirmed) {
                await Vault.deleteAllData();
                clearSensitiveState();
                state.isFirstTime = true;
                renderLockScreen();
                showScreen('lock-screen');
                UI.closeModal('settings-modal');
                UI.showToast('All data deleted', 'success');
            }
        });

        // Entry card clicks (delegation)
        document.getElementById('entries-container').addEventListener('click', (e) => {
            // Favorite toggle
            const favBtn = e.target.closest('[data-fav-id]');
            if (favBtn) {
                e.stopPropagation();
                toggleFavorite(favBtn.dataset.favId);
                return;
            }

            // Entry click
            const card = e.target.closest('.entry-card');
            if (card) {
                UI.showEntryDetail(card.dataset.id);
            }
        });

        // Detail modal
        document.getElementById('detail-close').addEventListener('click', () => UI.closeModal('detail-modal'));
        document.getElementById('detail-close-btn').addEventListener('click', () => UI.closeModal('detail-modal'));

        document.getElementById('detail-edit').addEventListener('click', () => {
            const entry = state.vault.entries.find(e => e.id === state.selectedEntryId);
            if (entry) {
                UI.closeModal('detail-modal');
                UI.openEditModal(entry);
            }
        });

        document.getElementById('detail-delete').addEventListener('click', () => {
            deleteEntry(state.selectedEntryId);
        });

        // Edit modal
        document.getElementById('edit-close').addEventListener('click', () => UI.closeModal('edit-modal'));
        document.getElementById('edit-cancel').addEventListener('click', () => UI.closeModal('edit-modal'));

        document.getElementById('edit-save').addEventListener('click', async () => {
            console.log('Save button clicked');
            try {
                const data = UI.collectEditData();
                console.log('Collected data:', data);
                if (data) {
                    console.log('Calling saveEntry...');
                    await saveEntry(data);
                    console.log('saveEntry completed');
                } else {
                    console.log('collectEditData returned null');
                }
            } catch (err) {
                console.error('Save click error:', err);
                UI.showToast('Error: ' + err.message, 'error');
            }
        });

        // Prevent form submit on Enter key
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
        });

        // Category selector in edit modal
        document.getElementById('category-selector').addEventListener('click', (e) => {
            const option = e.target.closest('.category-option');
            if (option) {
                const cat = option.dataset.category;
                console.log('Category clicked:', cat);
                document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');

                const entry = UI.getCurrentEditId() ? state.vault.entries.find(e => e.id === UI.getCurrentEditId()) : null;
                UI.renderDynamicFields(cat, entry);
                console.log('After renderDynamicFields, currentEditCategory:', UI.getCurrentEditCategory());
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K: Search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('search-input')?.focus();
            }

            // Ctrl+N: Add entry
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (!Session.getIsLocked()) openAddModal();
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                UI.closeAllModals();
            }

            // ?: Show shortcuts
            if (e.key === '?' && !e.target.matches('input, textarea')) {
                document.getElementById('shortcuts-overlay').classList.toggle('active');
            }
        });

        document.getElementById('shortcuts-close').addEventListener('click', () => {
            document.getElementById('shortcuts-overlay').classList.remove('active');
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        init,
        state,
        clearSensitiveState,
        renderDashboard,
        openAddModal
    };
})();

// ─── Initialize on DOM Ready ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
