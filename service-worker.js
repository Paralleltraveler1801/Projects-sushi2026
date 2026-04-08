const CACHE_NAME = 'hishita-admin-v2';
const CACHE_URLS = ['/admin.html', '/admin.js', '/admin.css', '/NSF-279-14.wav'];

// インストール時にキャッシュ
self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS).catch(() => {}))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

// プッシュ通知受信
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {};
    e.waitUntil(
        self.registration.showNotification(data.title || '🍣 新しい出前注文', {
            body:      data.body || '管理画面を確認してください',
            icon:      '/images/shop01.jpg',
            badge:     '/images/shop01.jpg',
            tag:       'demae-order',
            renotify:  true,
            data:      { url: '/admin.html' }
        })
    );
});

// 通知クリック → 管理画面を開く / フォーカス
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes('admin.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/admin.html');
        })
    );
});
