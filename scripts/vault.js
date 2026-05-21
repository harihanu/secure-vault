'use strict';

/**
 * Vault Module — CRUD operations for vault entries
 * Uses Web Worker when available, falls back to direct crypto on file://
 */

const Vault = (() => {
    let useWorker = false;
    let cryptoWorker = null;
    let pendingCallbacks = new Map();
    let messageId = 0;

    // ─── Direct Crypto Functions (fallback for file://) ────────────

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    async function directDeriveKey(password, salt, iterations = 600000) {
        const passwordBytes = new TextEncoder().encode(password);
        const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        passwordBytes.fill(0);
        return key;
    }

    async function directEncrypt(data, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(data);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);
        return { ciphertext: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv) };
    }

    async function directDecrypt(ciphertextBase64, ivBase64, key) {
        const ciphertext = base64ToArrayBuffer(ciphertextBase64);
        const iv = base64ToArrayBuffer(ivBase64);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }

    async function directChecksum(data) {
        const encoded = new TextEncoder().encode(data);
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        return arrayBufferToBase64(hash);
    }

    async function directSaveVault(data, password, existingSalt) {
        const salt = existingSalt ? new Uint8Array(base64ToArrayBuffer(existingSalt)) : crypto.getRandomValues(new Uint8Array(32));
        const key = await directDeriveKey(password, salt);
        const jsonString = JSON.stringify(data);
        const checksum = await directChecksum(jsonString);
        const { ciphertext, iv } = await directEncrypt(jsonString, key);
        return {
            encrypted: ciphertext, iv: iv, salt: arrayBufferToBase64(salt),
            checksum: checksum, version: 1, iterations: 600000, createdAt: new Date().toISOString()
        };
    }

    async function directLoadVault(password, envelope) {
        const salt = new Uint8Array(base64ToArrayBuffer(envelope.salt));
        const key = await directDeriveKey(password, salt, envelope.iterations || 600000);
        const decryptedJson = await directDecrypt(envelope.encrypted, envelope.iv, key);
        const checksum = await directChecksum(decryptedJson);
        if (checksum !== envelope.checksum) throw new Error('Vault integrity check failed');
        return JSON.parse(decryptedJson);
    }

    // TOTP
    const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    function base32Decode(encoded) {
        encoded = encoded.replace(/=+$/, '').toUpperCase();
        let bits = '';
        for (let i = 0; i < encoded.length; i++) {
            const val = BASE32.indexOf(encoded[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = new Uint8Array(Math.floor(bits.length / 8));
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
        return bytes;
    }

    function base32Encode(buffer) {
        const bytes = new Uint8Array(buffer);
        let bits = '';
        for (let i = 0; i < bytes.length; i++) bits += bytes[i].toString(2).padStart(8, '0');
        let result = '';
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substr(i, 5).padEnd(5, '0');
            result += BASE32[parseInt(chunk, 2)];
        }
        return result;
    }

    async function directGenerateTOTPSecret() {
        return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
    }

    async function directVerifyTOTP(secretBase32, code, window = 1) {
        const counter = Math.floor(Date.now() / 1000 / 30);
        for (let i = -window; i <= window; i++) {
            const adjustedCounter = counter + i;
            const counterBytes = new Uint8Array(8);
            let temp = adjustedCounter;
            for (let j = 7; j >= 0; j--) { counterBytes[j] = temp & 0xff; temp = Math.floor(temp / 256); }
            const secretBytes = base32Decode(secretBase32);
            const hmacKey = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
            const hmacResult = await crypto.subtle.sign('HMAC', hmacKey, counterBytes);
            const hmacArray = new Uint8Array(hmacResult);
            const offset = hmacArray[hmacArray.length - 1] & 0x0f;
            const generatedCode = ((hmacArray[offset] & 0x7f) << 24 | (hmacArray[offset + 1] & 0xff) << 16 | (hmacArray[offset + 2] & 0xff) << 8 | hmacArray[offset + 3] & 0xff) % 1000000;
            if (generatedCode.toString().padStart(6, '0') === code) return true;
        }
        return false;
    }

    function directGenerateRecoveryCodes(count = 8) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const bytes = crypto.getRandomValues(new Uint8Array(6));
            let code = '';
            for (let j = 0; j < bytes.length; j++) code += bytes[j].toString(16).padStart(2, '0');
            codes.push(code.match(/.{1,4}/g).join('-'));
        }
        return codes;
    }

    function directGenerateUUID() {
        if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // ─── Direct call handler ───────────────────────────────────────

    async function directCall(action, payload) {
        switch (action) {
            case 'saveVault': return directSaveVault(payload.data, payload.password, payload.existingSalt);
            case 'loadVault': return directLoadVault(payload.password, payload.envelope);
            case 'generateUUID': return directGenerateUUID();
            case 'generateTOTPSecret': return directGenerateTOTPSecret();
            case 'verifyTOTP': return directVerifyTOTP(payload.secret, payload.code, payload.window);
            case 'generateRecoveryCodes': return directGenerateRecoveryCodes(payload.count);
            case 'generateTOTP': {
                const counter = Math.floor(Date.now() / 1000 / 30);
                const counterBytes = new Uint8Array(8);
                let temp = counter;
                for (let j = 7; j >= 0; j--) { counterBytes[j] = temp & 0xff; temp = Math.floor(temp / 256); }
                const secretBytes = base32Decode(payload.secret);
                const hmacKey = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
                const hmacResult = await crypto.subtle.sign('HMAC', hmacKey, counterBytes);
                const hmacArray = new Uint8Array(hmacResult);
                const offset = hmacArray[hmacArray.length - 1] & 0x0f;
                const code = ((hmacArray[offset] & 0x7f) << 24 | (hmacArray[offset + 1] & 0xff) << 16 | (hmacArray[offset + 2] & 0xff) << 8 | hmacArray[offset + 3] & 0xff) % 1000000;
                return code.toString().padStart(6, '0');
            }
            default: throw new Error('Unknown action: ' + action);
        }
    }

    // ─── Worker Communication ──────────────────────────────────────

    function initWorker() {
        // Only try worker on http/https
        if (location.protocol === 'file:') {
            useWorker = false;
            return;
        }

        try {
            cryptoWorker = new Worker('workers/crypto-worker.js');
            useWorker = true;

            cryptoWorker.onmessage = (e) => {
                const { id, success, result, error } = e.data;
                if (id === 'init') return;
                const callback = pendingCallbacks.get(id);
                if (callback) {
                    pendingCallbacks.delete(id);
                    success ? callback.resolve(result) : callback.reject(new Error(error));
                }
            };

            cryptoWorker.onerror = (error) => {
                console.error('Crypto worker error:', error);
            };
        } catch (e) {
            useWorker = false;
        }
    }

    function callCrypto(action, payload) {
        if (useWorker && cryptoWorker) {
            return new Promise((resolve, reject) => {
                const id = ++messageId;
                pendingCallbacks.set(id, { resolve, reject });
                cryptoWorker.postMessage({ id, action, payload });
            });
        }
        return directCall(action, payload);
    }

    // ─── Vault Operations ──────────────────────────────────────────

    async function createVault(vaultData, password) {
        const envelope = await callCrypto('saveVault', { data: vaultData, password: password, existingSalt: null });
        await Storage.saveEncryptedVault(envelope);
        return envelope;
    }

    async function saveVault(vaultData, password, existingSalt) {
        const envelope = await callCrypto('saveVault', { data: vaultData, password: password, existingSalt: existingSalt });
        await Storage.saveEncryptedVault(envelope);
        return envelope;
    }

    async function loadVault(password) {
        const envelope = await Storage.loadEncryptedVault();
        if (!envelope) throw new Error('No vault found');
        const data = await callCrypto('loadVault', { password: password, envelope: envelope });
        return { data, envelope };
    }

    async function decryptEnvelope(password, envelope) {
        return callCrypto('loadVault', { password: password, envelope: envelope });
    }

    async function vaultExists() { return Storage.vaultExists(); }
    async function deleteAllData() { await Storage.deleteVault(); }
    async function generateId() { return callCrypto('generateUUID', {}); }
    async function generateTOTPSecret() { return callCrypto('generateTOTPSecret', {}); }
    async function generateTOTP(secret) { return callCrypto('generateTOTP', { secret }); }
    async function verifyTOTP(secret, code) { return callCrypto('verifyTOTP', { secret, code, window: 1 }); }
    async function generateRecoveryCodes(count = 8) { return callCrypto('generateRecoveryCodes', { count }); }

    function terminate() {
        if (cryptoWorker) { cryptoWorker.terminate(); cryptoWorker = null; }
        pendingCallbacks.clear();
    }

    function init() { initWorker(); }

    return {
        init, createVault, saveVault, loadVault, decryptEnvelope,
        vaultExists, deleteAllData, generateId,
        generateTOTPSecret, generateTOTP, verifyTOTP, generateRecoveryCodes, terminate
    };
})();
