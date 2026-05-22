'use strict';

/**
 * Service Worker — Offline caching for Secure Vault
 * IMPORTANT: Never cache decrypted vault content.
 */

const CACHE_NAME = 'secure-vault-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles/main.css',
    './scripts/validators.js',
    './scripts/storage.js',
    './scripts/security.js',
    './scripts/password-generator.js',
    './scripts/search.js',
    './scripts/audit.js',
    './scripts/vault.js',
    './scripts/session.js',
    './scripts/settings.js',
    './scripts/backup.js',
    './scripts/ui.js',
    './scripts/app.js',
    './workers/crypto-worker.js',
    './assets/manifest.json',
    './assets/icon.svg',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

// ─── Install ──────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ─── Activate ─────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// ─── Fetch — Cache-first for static assets ────────────────────────

self.addEventListener('fetch', (event) => {
    // Only cache GET requests for same-origin static assets
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only cache same-origin requests
    if (url.origin !== location.origin) return;

    // Never cache API calls or dynamic endpoints
    if (url.pathname.includes('/api/')) return;

    // Cache-first strategy for static assets
    if (STATIC_ASSETS.some(asset => {
        const assetPath = new URL(asset, location.origin).pathname;
        return url.pathname === assetPath || url.pathname === assetPath.replace(/\/$/, '');
    })) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first for everything else (vault data, etc.)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ─── Background Sync (placeholder) ────────────────────────────────

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        // Placeholder for future background sync
    }
});

// ─── Push Notifications (placeholder) ─────────────────────────────

self.addEventListener('push', (event) => {
    // Placeholder for future push notifications
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
