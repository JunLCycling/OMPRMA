const CACHE_NAME = 'track-scorer-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];
const OPTIONAL_ASSETS = [
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 核心檔案強制重新抓取最新檔並寫入快取
      await Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
        )
      );
      // 圖示類檔案若檔名有改動或不存在，不影響主程式離線安裝
      await Promise.allSettled(
        OPTIONAL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  // 1. 頁面開啟／重整請求（離線時確保退回 index.html）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', cloned));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match('./index.html', { ignoreSearch: true })) ||
            (await cache.match('./', { ignoreSearch: true }))
          );
        })
    );
    return;
  }

  // 2. 其他靜態檔案
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
