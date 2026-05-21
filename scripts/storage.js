'use strict';

/**
 * Storage Module — IndexedDB wrapper for encrypted vault persistence
 * Stores only encrypted data. Never stores plaintext vault contents.
 */

const Storage = (() => {
    const DB_NAME = 'SecureVaultDB';
    const DB_VERSION = 1;
    const STORES = {
        VAULT: 'vault',
        SETTINGS: 'settings',
        AUDIT: 'audit'
    };

    let db = null;

    // ─── Database Initialization ───────────────────────────────────

    function open() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORES.VAULT)) {
                    database.createObjectStore(STORES.VAULT, { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                    database.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
                }
                if (!database.objectStoreNames.contains(STORES.AUDIT)) {
                    database.createObjectStore(STORES.AUDIT, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                db.onversionchange = () => {
                    db.close();
                    db = null;
                };
                resolve(db);
            };

            request.onerror = (event) => {
                reject(new Error(`IndexedDB open failed: ${event.target.error}`));
            };
        });
    }

    // ─── Generic CRUD ──────────────────────────────────────────────

    async function get(storeName, id) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error(`Get failed: ${request.error}`));
        });
    }

    async function put(storeName, data) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Put failed: ${request.error}`));
        });
    }

    async function remove(storeName, id) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Delete failed: ${request.error}`));
        });
    }

    async function clear(storeName) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Clear failed: ${request.error}`));
        });
    }

    async function getAll(storeName) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error(`GetAll failed: ${request.error}`));
        });
    }

    // ─── Vault-Specific Methods ────────────────────────────────────

    async function saveEncryptedVault(envelope) {
        return put(STORES.VAULT, { id: 'main', ...envelope });
    }

    async function loadEncryptedVault() {
        return get(STORES.VAULT, 'main');
    }

    async function deleteVault() {
        await clear(STORES.VAULT);
        await clear(STORES.SETTINGS);
        await clear(STORES.AUDIT);
    }

    async function vaultExists() {
        const vault = await get(STORES.VAULT, 'main');
        return vault !== null;
    }

    // ─── Settings (encrypted) ──────────────────────────────────────

    async function saveSettings(settings) {
        return put(STORES.SETTINGS, { id: 'settings', ...settings });
    }

    async function loadSettings() {
        return get(STORES.SETTINGS, 'settings');
    }

    // ─── Audit Log (encrypted) ─────────────────────────────────────

    async function saveAuditLog(log) {
        return put(STORES.AUDIT, { id: 'audit', entries: log });
    }

    async function loadAuditLog() {
        const data = await get(STORES.AUDIT, 'audit');
        return data ? data.entries : [];
    }

    // ─── Database Info ─────────────────────────────────────────────

    async function getStorageSize() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0
            };
        }
        return { usage: 0, quota: 0 };
    }

    async function destroy() {
        if (db) {
            db.close();
            db = null;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to delete database'));
        });
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        open,
        get,
        put,
        remove,
        clear,
        getAll,
        saveEncryptedVault,
        loadEncryptedVault,
        deleteVault,
        vaultExists,
        saveSettings,
        loadSettings,
        saveAuditLog,
        loadAuditLog,
        getStorageSize,
        destroy,
        STORES
    };
})();
