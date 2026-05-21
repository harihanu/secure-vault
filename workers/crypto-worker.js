'use strict';

/**
 * Crypto Worker — All cryptographic operations run here (isolated from main thread)
 * Handles: PBKDF2 key derivation, AES-256-GCM encrypt/decrypt, SHA-256 checksum, TOTP
 */

// ─── Base64 Helpers ────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ─── Key Derivation ────────────────────────────────────────────────

async function deriveKey(password, salt, iterations = 600000) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    // Clear password from memory
    passwordBytes.fill(0);

    return key;
}

// ─── Encryption / Decryption ───────────────────────────────────────

async function encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
    );

    return {
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv)
    };
}

async function decrypt(ciphertextBase64, ivBase64, key) {
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

// ─── Checksum (SHA-256) ───────────────────────────────────────────

async function computeChecksum(data) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return arrayBufferToBase64(hashBuffer);
}

// ─── Vault Save / Load ─────────────────────────────────────────────

async function saveVault(data, password, existingSalt = null) {
    const salt = existingSalt
        ? new Uint8Array(base64ToArrayBuffer(existingSalt))
        : crypto.getRandomValues(new Uint8Array(32));

    const key = await deriveKey(password, salt);
    const jsonString = JSON.stringify(data);
    const checksum = await computeChecksum(jsonString);

    const { ciphertext, iv } = await encrypt(jsonString, key);

    const envelope = {
        encrypted: ciphertext,
        iv: iv,
        salt: arrayBufferToBase64(salt),
        checksum: checksum,
        version: 1,
        iterations: 600000,
        createdAt: new Date().toISOString()
    };

    return envelope;
}

async function loadVault(password, envelope) {
    const salt = new Uint8Array(base64ToArrayBuffer(envelope.salt));
    const key = await deriveKey(password, salt, envelope.iterations || 600000);

    const decryptedJson = await decrypt(envelope.encrypted, envelope.iv, key);

    // Verify integrity
    const checksum = await computeChecksum(decryptedJson);
    if (checksum !== envelope.checksum) {
        throw new Error('Vault integrity check failed. Data may have been tampered with.');
    }

    const data = JSON.parse(decryptedJson);
    return data;
}

// ─── TOTP (RFC 6238) ──────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded) {
    encoded = encoded.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (let i = 0; i < encoded.length; i++) {
        const val = BASE32_ALPHABET.indexOf(encoded[i]);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
    }
    return bytes;
}

function base32Encode(buffer) {
    const bytes = new Uint8Array(buffer);
    let bits = '';
    for (let i = 0; i < bytes.length; i++) {
        bits += bytes[i].toString(2).padStart(8, '0');
    }
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.substr(i, 5).padEnd(5, '0');
        result += BASE32_ALPHABET[parseInt(chunk, 2)];
    }
    return result;
}

async function generateTOTPSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return base32Encode(bytes);
}

async function generateTOTP(secretBase32, timeStep = 30) {
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const counterBytes = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
        counterBytes[i] = temp & 0xff;
        temp = Math.floor(temp / 256);
    }

    const secretBytes = base32Decode(secretBase32);
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const hmacResult = await crypto.subtle.sign('HMAC', hmacKey, counterBytes);
    const hmacArray = new Uint8Array(hmacResult);

    const offset = hmacArray[hmacArray.length - 1] & 0x0f;
    const code = (
        ((hmacArray[offset] & 0x7f) << 24) |
        ((hmacArray[offset + 1] & 0xff) << 16) |
        ((hmacArray[offset + 2] & 0xff) << 8) |
        (hmacArray[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
}

async function verifyTOTP(secretBase32, code, window = 1) {
    const counter = Math.floor(Date.now() / 1000 / 30);

    for (let i = -window; i <= window; i++) {
        const adjustedCounter = counter + i;
        const counterBytes = new Uint8Array(8);
        let temp = adjustedCounter;
        for (let j = 7; j >= 0; j--) {
            counterBytes[j] = temp & 0xff;
            temp = Math.floor(temp / 256);
        }

        const secretBytes = base32Decode(secretBase32);
        const hmacKey = await crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );

        const hmacResult = await crypto.subtle.sign('HMAC', hmacKey, counterBytes);
        const hmacArray = new Uint8Array(hmacResult);

        const offset = hmacArray[hmacArray.length - 1] & 0x0f;
        const generatedCode = (
            ((hmacArray[offset] & 0x7f) << 24) |
            ((hmacArray[offset + 1] & 0xff) << 16) |
            ((hmacArray[offset + 2] & 0xff) << 8) |
            (hmacArray[offset + 3] & 0xff)
        ) % 1000000;

        if (generatedCode.toString().padStart(6, '0') === code) {
            return true;
        }
    }
    return false;
}

// ─── Recovery Codes ────────────────────────────────────────────────

function generateRecoveryCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        let code = '';
        for (let j = 0; j < bytes.length; j++) {
            code += bytes[j].toString(16).padStart(2, '0');
        }
        codes.push(code.match(/.{1,4}/g).join('-'));
    }
    return codes;
}

// ─── UUID Generation ───────────────────────────────────────────────

function generateUUID() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ─── Message Handler ───────────────────────────────────────────────

self.onmessage = async function (e) {
    const { id, action, payload } = e.data;

    try {
        let result;

        switch (action) {
            case 'deriveKey':
                result = await deriveKey(payload.password, new Uint8Array(base64ToArrayBuffer(payload.salt)), payload.iterations);
                break;

            case 'encrypt':
                result = await encrypt(payload.data, payload.key);
                break;

            case 'decrypt':
                result = await decrypt(payload.ciphertext, payload.iv, payload.key);
                break;

            case 'saveVault':
                result = await saveVault(payload.data, payload.password, payload.existingSalt);
                break;

            case 'loadVault':
                result = await loadVault(payload.password, payload.envelope);
                break;

            case 'generateTOTPSecret':
                result = await generateTOTPSecret();
                break;

            case 'generateTOTP':
                result = await generateTOTP(payload.secret);
                break;

            case 'verifyTOTP':
                result = await verifyTOTP(payload.secret, payload.code, payload.window);
                break;

            case 'generateRecoveryCodes':
                result = generateRecoveryCodes(payload.count);
                break;

            case 'generateUUID':
                result = generateUUID();
                break;

            case 'computeChecksum':
                result = await computeChecksum(payload.data);
                break;

            case 'ping':
                result = 'pong';
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        self.postMessage({ id, success: true, result });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

self.postMessage({ id: 'init', success: true, result: 'Crypto worker ready' });
