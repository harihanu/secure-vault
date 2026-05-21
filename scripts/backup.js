'use strict';

/**
 * Backup Module — Import/export vault with integrity validation
 */

const Backup = (() => {

    // ─── Export Vault ──────────────────────────────────────────────

    async function exportVault() {
        try {
            const envelope = await Storage.loadEncryptedVault();
            if (!envelope) {
                UI.showToast('No vault to export', 'error');
                return;
            }

            const date = new Date().toISOString().split('T')[0];
            const filename = `vault-backup-${date}.vault`;

            const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();

            URL.revokeObjectURL(url);

            Audit.log('vault_exported', `Exported vault as ${filename}`);
            Settings.update({ lastBackup: new Date().toISOString() });

            UI.showToast(`Vault exported as ${filename}`, 'success');
        } catch (error) {
            UI.showToast('Export failed: ' + error.message, 'error');
        }
    }

    // ─── Import Vault ──────────────────────────────────────────────

    async function importVault(file, mode, importPassword) {
        try {
            const text = await readFileAsText(file);
            const envelope = JSON.parse(text);

            const validation = Validators.validateEnvelope(envelope);
            if (!validation.valid) {
                UI.showToast('Invalid vault file: ' + validation.error, 'error');
                return false;
            }

            // Decrypt imported vault
            let importedData;
            try {
                importedData = await Vault.decryptEnvelope(importPassword, envelope);
            } catch (error) {
                UI.showToast('Failed to decrypt: wrong password or corrupted file', 'error');
                return false;
            }

            const vaultData = importedData;
            const schemaCheck = Validators.validateVaultSchema(vaultData);
            if (!schemaCheck.valid) {
                UI.showToast('Invalid vault structure: ' + schemaCheck.error, 'error');
                return false;
            }

            if (mode === 'replace') {
                App.state.vault.entries = vaultData.entries;
                UI.showToast(`Replaced vault with ${vaultData.entries.length} entries`, 'success');
            } else {
                // Merge: add new, update existing
                let added = 0;
                let updated = 0;

                for (const importedEntry of vaultData.entries) {
                    const existingIndex = App.state.vault.entries.findIndex(e => e.id === importedEntry.id);

                    if (existingIndex === -1) {
                        App.state.vault.entries.push(importedEntry);
                        added++;
                    } else {
                        const existing = App.state.vault.entries[existingIndex];
                        if (new Date(importedEntry.updatedAt) > new Date(existing.updatedAt)) {
                            App.state.vault.entries[existingIndex] = importedEntry;
                            updated++;
                        }
                    }
                }

                UI.showToast(`Merged: ${added} added, ${updated} updated`, 'success');
            }

            // Save vault
            const envelope2 = await Vault.saveVault(
                App.state.vault,
                App.state.masterPassword,
                App.state.salt
            );
            App.state.salt = envelope2.salt;

            Audit.log('vault_imported', `Imported vault (${mode} mode)`);
            App.renderDashboard();

            return true;
        } catch (error) {
            UI.showToast('Import failed: ' + error.message, 'error');
            return false;
        }
    }

    // ─── Read File ─────────────────────────────────────────────────

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        exportVault,
        importVault
    };
})();
