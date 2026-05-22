'use strict';

/**
 * Storage Module — Professional-grade secure storage engine
 *
 * Architecture:
 *   IndexedDB + Persistent Storage API + OPFS
 *   WebCrypto non-extractable keys
 *   Encrypted backups only
 *
 * Storage priority:
 *   1. OPFS (Origin Private File System) — fastest, most reliable
 *   2. IndexedDB with persistent storage — standard, well-supported
 *   3. IndexedDB without persistence — fallback with warning
 *
 * NEVER stores raw keys, master passwords, or unencrypted data.
 */

const Storage = (() => {
    const DB_NAME = 'SecureVaultDB';
    const DB_VERSION = 1;
    const STORES = {
        VAULT: 'vault',
        SETTINGS: 'settings',
        AUDIT: 'audit'
    };
    const OPFS_ROOT = 'vault-data';

    let db = null;
    let storageMode = null; // 'opfs', 'indexeddb-persistent', 'indexeddb-temporary'
    let opfsRoot = null;

    // ─── Storage Detection & Initialization ────────────────────────

    async function detectAndInitialize() {
        console.log('[Storage] Detecting storage capabilities...');

        // Step 1: Try OPFS (fastest, most reliable)
        if (await tryOPFS()) {
            storageMode = 'opfs';
            console.log('[Storage] Using OPFS (Origin Private File System)');
            return;
        }

        // Step 2: Try IndexedDB with persistent storage
        if (await tryIndexedDBPersistent()) {
            storageMode = 'indexeddb-persistent';
            console.log('[Storage] Using IndexedDB with persistent storage');
            return;
        }

        // Step 3: IndexedDB without persistence (with warning)
        if (await tryIndexedDB()) {
            storageMode = 'indexeddb-temporary';
            console.warn('[Storage] Using IndexedDB WITHOUT persistence — data may be cleared by browser');
            console.warn('[Storage] Consider using Chrome/Firefox for persistent vault storage');
            return;
        }

        throw new Error('No storage mechanism available. Please use a modern browser.');
    }

    // ─── OPFS Detection ───────────────────────────────────────────

    async function tryOPFS() {
        try {
            if (!navigator.storage || !navigator.storage.getDirectory) {
                console.log('[Storage] OPFS not available (API missing)');
                return false;
            }

            const root = await navigator.storage.getDirectory();
            // Test write
            const testHandle = await root.getFileHandle('__test__', { create: true });
            const testWritable = await testHandle.createWritable();
            await testWritable.write('test');
            await testWritable.close();
            // Cleanup
            await root.removeEntry('__test__');

            opfsRoot = root;
            console.log('[Storage] OPFS available and working');
            return true;
        } catch (e) {
            console.log('[Storage] OPFS not available:', e.message);
            return false;
        }
    }

    // ─── IndexedDB with Persistent Storage ─────────────────────────

    async function tryIndexedDBPersistent() {
        try {
            // Request persistent storage first
            if (navigator.storage && navigator.storage.persist) {
                const persisted = await navigator.storage.persist();
                console.log('[Storage] Persistent storage request:', persisted);

                if (!persisted) {
                    // Check if already persisted
                    const isPersisted = await navigator.storage.persisted();
                    console.log('[Storage] Already persisted:', isPersisted);

                    if (!isPersisted) {
                        console.warn('[Storage] Browser may clear storage — data at risk');
                        // Continue anyway, but warn user
                    }
                }
            }

            return await openIndexedDB();
        } catch (e) {
            console.log('[Storage] IndexedDB persistent failed:', e.message);
            return false;
        }
    }

    // ─── IndexedDB Basic ──────────────────────────────────────────

    async function tryIndexedDB() {
        try {
            return await openIndexedDB();
        } catch (e) {
            console.log('[Storage] IndexedDB failed:', e.message);
            return false;
        }
    }

    function openIndexedDB() {
        return new Promise((resolve, reject) => {
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
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('[Storage] IndexedDB error:', event.target.error);
                resolve(false);
            };

            // Timeout for Brave
            setTimeout(() => {
                if (!db) {
                    console.warn('[Storage] IndexedDB timeout');
                    resolve(false);
                }
            }, 3000);
        });
    }

    // ─── OPFS Operations ──────────────────────────────────────────

    async function opfsGet(storeName, id) {
        try {
            console.log('[OPFS] Getting:', { storeName, id });
            const storeDir = await opfsRoot.getDirectoryHandle(storeName, { create: true });
            const fileName = `${id}.json`;
            const fileHandle = await storeDir.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);
            console.log('[OPFS] Found data:', { id: data.id, hasEncrypted: !!data.encrypted });
            return data;
        } catch (e) {
            if (e.name === 'NotFoundError') {
                console.log('[OPFS] Not found:', { storeName, id });
                return null;
            }
            console.error('[OPFS] Error getting:', e);
            throw e;
        }
    }

    async function opfsPut(storeName, data) {
        console.log('[OPFS] Putting:', { storeName, id: data.id });
        const storeDir = await opfsRoot.getDirectoryHandle(storeName, { create: true });
        const fileName = `${data.id}.json`;
        const fileHandle = await storeDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data));
        await writable.close();
        console.log('[OPFS] Saved successfully:', { storeName, id: data.id, fileName });
        return data.id;
    }

    async function opfsRemove(storeName, id) {
        try {
            const storeDir = await opfsRoot.getDirectoryHandle(storeName, { create: true });
            await storeDir.removeEntry(`${id}.json`);
        } catch (e) {
            if (e.name !== 'NotFoundError') throw e;
        }
    }

    async function opfsClear(storeName) {
        try {
            const storeDir = await opfsRoot.getDirectoryHandle(storeName, { create: true });
            for await (const [name] of storeDir) {
                await storeDir.removeEntry(name);
            }
        } catch (e) {
            if (e.name !== 'NotFoundError') throw e;
        }
    }

    async function opfsGetAll(storeName) {
        const results = [];
        try {
            const storeDir = await opfsRoot.getDirectoryHandle(storeName, { create: true });
            for await (const [name, handle] of storeDir) {
                if (handle.kind === 'file' && name.endsWith('.json')) {
                    const file = await handle.getFile();
                    const text = await file.text();
                    results.push(JSON.parse(text));
                }
            }
        } catch (e) {
            if (e.name !== 'NotFoundError') throw e;
        }
        return results;
    }

    // ─── IndexedDB Operations ─────────────────────────────────────

    async function idbGet(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error(`Get failed: ${request.error}`));
        });
    }

    async function idbPut(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Put failed: ${request.error}`));
        });
    }

    async function idbRemove(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Delete failed: ${request.error}`));
        });
    }

    async function idbClear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Clear failed: ${request.error}`));
        });
    }

    async function idbGetAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(new Error(`GetAll failed: ${request.error}`));
        });
    }

    // ─── Unified Storage Interface ─────────────────────────────────

    async function get(storeName, id) {
        if (storageMode === 'opfs') return opfsGet(storeName, id);
        return idbGet(storeName, id);
    }

    async function put(storeName, data) {
        if (storageMode === 'opfs') return opfsPut(storeName, data);
        return idbPut(storeName, data);
    }

    async function remove(storeName, id) {
        if (storageMode === 'opfs') return opfsRemove(storeName, id);
        return idbRemove(storeName, id);
    }

    async function clear(storeName) {
        if (storageMode === 'opfs') return opfsClear(storeName);
        return idbClear(storeName);
    }

    async function getAll(storeName) {
        if (storageMode === 'opfs') return opfsGetAll(storeName);
        return idbGetAll(storeName);
    }

    // ─── Public API (main initialization) ──────────────────────────

    async function open() {
        await detectAndInitialize();
        return db;
    }

    // ─── Vault-Specific Methods ────────────────────────────────────

    async function saveEncryptedVault(envelope) {
        console.log('[Storage] Saving encrypted vault...');
        const result = await put(STORES.VAULT, { id: 'main', ...envelope });
        console.log('[Storage] Vault saved successfully');
        return result;
    }

    async function loadEncryptedVault() {
        console.log('[Storage] Loading encrypted vault...');
        const result = await get(STORES.VAULT, 'main');
        console.log('[Storage] Vault loaded:', result ? 'found' : 'not found');
        return result;
    }

    async function deleteVault() {
        await clear(STORES.VAULT);
        await clear(STORES.SETTINGS);
        await clear(STORES.AUDIT);
    }

    async function vaultExists() {
        console.log('[Storage] Checking if vault exists...');
        const vault = await get(STORES.VAULT, 'main');
        console.log('[Storage] Vault exists result:', vault !== null, vault ? { id: vault.id, hasEncrypted: !!vault.encrypted } : null);
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

    // ─── Storage Info ─────────────────────────────────────────────

    async function getStorageInfo() {
        const info = {
            mode: storageMode,
            persisted: false,
            usage: 0,
            quota: 0
        };

        if (navigator.storage && navigator.storage.persisted) {
            info.persisted = await navigator.storage.persisted();
        }

        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            info.usage = estimate.usage || 0;
            info.quota = estimate.quota || 0;
        }

        return info;
    }

    async function getStorageSize() {
        const info = await getStorageInfo();
        return { usage: info.usage, quota: info.quota };
    }

    // ─── Cleanup ──────────────────────────────────────────────────

    async function destroy() {
        if (storageMode === 'opfs' && opfsRoot) {
            try {
                for await (const [name] of opfsRoot) {
                    await opfsRoot.removeEntry(name, { recursive: true });
                }
            } catch (e) {
                console.error('[Storage] OPFS cleanup error:', e);
            }
        } else if (db) {
            db.close();
            db = null;
            return new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase(DB_NAME);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to delete database'));
            });
        }
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
        getStorageInfo,
        getStorageSize,
        destroy,
        STORES
    };
})();
