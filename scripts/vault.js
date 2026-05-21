'use strict';

/**
 * Vault Module — CRUD operations for vault entries via crypto worker
 */

const Vault = (() => {
    let cryptoWorker = null;
    let pendingCallbacks = new Map();
    let messageId = 0;

    // ─── Crypto Worker Communication ───────────────────────────────

    function initWorker() {
        cryptoWorker = new Worker('workers/crypto-worker.js');

        cryptoWorker.onmessage = (e) => {
            const { id, success, result, error } = e.data;
            if (id === 'init') return;

            const callback = pendingCallbacks.get(id);
            if (callback) {
                pendingCallbacks.delete(id);
                if (success) {
                    callback.resolve(result);
                } else {
                    callback.reject(new Error(error));
                }
            }
        };

        cryptoWorker.onerror = (error) => {
            console.error('Crypto worker error:', error);
        };
    }

    function callWorker(action, payload) {
        return new Promise((resolve, reject) => {
            const id = ++messageId;
            pendingCallbacks.set(id, { resolve, reject });
            cryptoWorker.postMessage({ id, action, payload });
        });
    }

    // ─── Vault Operations ──────────────────────────────────────────

    async function createVault(vaultData, password) {
        const envelope = await callWorker('saveVault', {
            data: vaultData,
            password: password,
            existingSalt: null
        });
        await Storage.saveEncryptedVault(envelope);
        return envelope;
    }

    async function saveVault(vaultData, password, existingSalt) {
        const envelope = await callWorker('saveVault', {
            data: vaultData,
            password: password,
            existingSalt: existingSalt
        });
        await Storage.saveEncryptedVault(envelope);
        return envelope;
    }

    async function loadVault(password) {
        const envelope = await Storage.loadEncryptedVault();
        if (!envelope) {
            throw new Error('No vault found');
        }
        const data = await callWorker('loadVault', {
            password: password,
            envelope: envelope
        });
        return { data, envelope };
    }

    async function decryptEnvelope(password, envelope) {
        const data = await callWorker('loadVault', {
            password: password,
            envelope: envelope
        });
        return data;
    }

    async function vaultExists() {
        return Storage.vaultExists();
    }

    async function deleteAllData() {
        await Storage.deleteVault();
    }

    // ─── UUID Generation ───────────────────────────────────────────

    async function generateId() {
        return callWorker('generateUUID', {});
    }

    // ─── TOTP Operations ───────────────────────────────────────────

    async function generateTOTPSecret() {
        return callWorker('generateTOTPSecret', {});
    }

    async function generateTOTP(secret) {
        return callWorker('generateTOTP', { secret });
    }

    async function verifyTOTP(secret, code) {
        return callWorker('verifyTOTP', { secret, code, window: 1 });
    }

    async function generateRecoveryCodes(count = 8) {
        return callWorker('generateRecoveryCodes', { count });
    }

    // ─── Worker Lifecycle ──────────────────────────────────────────

    function terminate() {
        if (cryptoWorker) {
            cryptoWorker.terminate();
            cryptoWorker = null;
        }
        pendingCallbacks.clear();
    }

    function init() {
        initWorker();
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        init,
        createVault,
        saveVault,
        loadVault,
        decryptEnvelope,
        vaultExists,
        deleteAllData,
        generateId,
        generateTOTPSecret,
        generateTOTP,
        verifyTOTP,
        generateRecoveryCodes,
        terminate
    };
})();
