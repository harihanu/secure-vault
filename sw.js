'use strict';

/**
 * Service Worker — Offline caching for Secure Vault
 * IMPORTANT: Never cache decrypted vault content.
 */

const CACHE_NAME = 'secure-vault-v3';
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

// ─── Install — Pre-cache app shell ────────────────────────────────

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ─── Activate — Clean old caches ──────────────────────────────────

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

// ─── Fetch — Offline-first with network fallback ──────────────────

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// ─── Periodic Background Sync ─────────────────────────────────────

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'vault-check') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll(STATIC_ASSETS);
            })
        );
    }
});

// ─── Background Sync ──────────────────────────────────────────────

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        // Placeholder for future background sync
    }
});

// ─── Push Notifications ───────────────────────────────────────────

self.addEventListener('push', (event) => {
    // Placeholder for future push notifications
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
