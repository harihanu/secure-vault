'use strict';

const CACHE_NAME = 'secure-vault-v4';
const ASSETS = [
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
    './assets/icon-512.png',
    './assets/widget-template.json'
];

// Install: pre-cache all app shell assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: serve from cache, fall back to network, cache new requests
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                if (fetchResponse && fetchResponse.status === 200) {
                    const clone = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return fetchResponse;
            });
        }).catch(() => {
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});

// Periodic Background Sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'vault-check') {
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    }
});

// Background Sync
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        // placeholder
    }
});

// Push
self.addEventListener('push', () => {});
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
