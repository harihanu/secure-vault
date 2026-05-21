'use strict';

/**
 * Password Generator Module — Generate secure passwords, passphrases, PINs
 */

const PasswordGenerator = (() => {

    const CHAR_SETS = {
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    const WORD_LIST = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
        'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
        'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
        'yankee', 'zulu', 'amber', 'bridge', 'castle', 'dragon', 'eagle', 'falcon',
        'garden', 'harbor', 'island', 'jungle', 'knight', 'lunar', 'marble', 'north',
        'ocean', 'pearl', 'quartz', 'river', 'silver', 'tower', 'ultra', 'violet',
        'winter', 'xenon', 'yellow', 'zenith', 'anchor', 'beacon', 'cipher', 'dusk',
        'ember', 'frost', 'grain', 'haven', 'ivory', 'jasper', 'karma', 'lotus',
        'maple', 'nectar', 'onyx', 'prism', 'quest', 'raven', 'storm', 'tempo',
        'umbra', 'vapor', 'wraith', 'blaze', 'crest', 'drift', 'flame', 'grove',
        'helix', 'inlet', 'jewel', 'knoll', 'latch', 'mocha', 'nerve', 'orbit',
        'pulse', 'quill', 'ridge', 'shard', 'thorn', 'unity', 'vigor', 'wedge'
    ];

    // ─── Random Index (crypto-safe) ────────────────────────────────

    function secureRandomIndex(max) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] % max;
    }

    // ─── Password Generation ───────────────────────────────────────

    function generatePassword(length = 16, options = {}) {
        const {
            uppercase = true,
            lowercase = true,
            numbers = true,
            symbols = true
        } = options;

        let pool = '';
        const requiredSets = [];

        if (lowercase) { pool += CHAR_SETS.lowercase; requiredSets.push(CHAR_SETS.lowercase); }
        if (uppercase) { pool += CHAR_SETS.uppercase; requiredSets.push(CHAR_SETS.uppercase); }
        if (numbers) { pool += CHAR_SETS.numbers; requiredSets.push(CHAR_SETS.numbers); }
        if (symbols) { pool += CHAR_SETS.symbols; requiredSets.push(CHAR_SETS.symbols); }

        if (pool.length === 0) {
            pool = CHAR_SETS.lowercase + CHAR_SETS.uppercase + CHAR_SETS.numbers;
            requiredSets.push(CHAR_SETS.lowercase, CHAR_SETS.uppercase, CHAR_SETS.numbers);
        }

        // Generate random characters
        let password = '';
        for (let i = 0; i < length; i++) {
            password += pool[secureRandomIndex(pool.length)];
        }

        // Ensure at least one character from each required set
        const passwordArray = password.split('');
        for (let i = 0; i < requiredSets.length && i < length; i++) {
            const set = requiredSets[i];
            const pos = secureRandomIndex(length);
            passwordArray[pos] = set[secureRandomIndex(set.length)];
        }

        return passwordArray.join('');
    }

    // ─── Passphrase Generation ─────────────────────────────────────

    function generatePassphrase(wordCount = 4, separator = '-') {
        const words = [];
        for (let i = 0; i < wordCount; i++) {
            const word = WORD_LIST[secureRandomIndex(WORD_LIST.length)];
            // Capitalize first letter
            words.push(word.charAt(0).toUpperCase() + word.slice(1));
        }
        return words.join(separator);
    }

    // ─── PIN Generation ────────────────────────────────────────────

    function generatePIN(length = 6) {
        let pin = '';
        for (let i = 0; i < length; i++) {
            pin += secureRandomIndex(10).toString();
        }
        return pin;
    }

    // ─── API Key Generation ────────────────────────────────────────

    function generateAPIKey(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < length; i++) {
            key += chars[secureRandomIndex(chars.length)];
        }
        return key;
    }

    // ─── Entropy Calculation ───────────────────────────────────────

    function calculateEntropy(password) {
        let poolSize = 0;
        if (/[a-z]/.test(password)) poolSize += 26;
        if (/[A-Z]/.test(password)) poolSize += 26;
        if (/[0-9]/.test(password)) poolSize += 10;
        if (/[^A-Za-z0-9]/.test(password)) poolSize += 33;

        const entropy = password.length * Math.log2(poolSize || 1);
        return Math.round(entropy * 10) / 10;
    }

    // ─── Strength Evaluation ───────────────────────────────────────

    function evaluateStrength(password) {
        if (!password) return { score: 0, label: 'None', color: '#64748b', entropy: 0 };

        const checks = {
            length8: password.length >= 8,
            length12: password.length >= 12,
            length16: password.length >= 16,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
            noRepeats: !/(.)\1{2,}/.test(password),
            noSequential: !/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)
        };

        let score = 0;
        if (checks.length8) score += 1;
        if (checks.length12) score += 0.5;
        if (checks.length16) score += 0.5;
        if (checks.lowercase) score += 0.5;
        if (checks.uppercase) score += 0.5;
        if (checks.number) score += 0.5;
        if (checks.special) score += 1;
        if (checks.noRepeats) score += 0.25;
        if (checks.noSequential) score += 0.25;

        score = Math.min(4, Math.round(score));

        const levels = [
            { label: 'Weak', color: '#ef4444' },
            { label: 'Fair', color: '#f59e0b' },
            { label: 'Good', color: '#eab308' },
            { label: 'Strong', color: '#22c55e' },
            { label: 'Very Strong', color: '#10b981' }
        ];

        return {
            score,
            label: levels[score].label,
            color: levels[score].color,
            entropy: calculateEntropy(password),
            checks
        };
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        generatePassword,
        generatePassphrase,
        generatePIN,
        generateAPIKey,
        calculateEntropy,
        evaluateStrength,
        CHAR_SETS,
        WORD_LIST
    };
})();
