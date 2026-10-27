// 輔導紀錄小幫手 Service Worker
// BUILD_VERSION 每次部署都要變（執行 scripts/bump-version.ps1），瀏覽器才會偵測到新版
const BUILD_VERSION = '2026.10.27-2';
const CACHE_PREFIX = 'crh-';
const CACHE = `${CACHE_PREFIX}${BUILD_VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  `./style.css?v=${BUILD_VERSION}`,
  `./app.js?v=${BUILD_VERSION}`,
  `./sw-register.js?v=${BUILD_VERSION}`,
  './icon.svg',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  // 不自動 skipWaiting：讓新版停在 waiting，由使用者在通知列決定何時套用
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u)))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED', version: BUILD_VERSION }));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  // 只處理自己網站的檔案；Gemini API 等外部請求一律不經過快取
  if (url.origin !== self.location.origin) return;

  // Service Worker 自己不快取，交給瀏覽器的更新機制
  if (url.pathname.endsWith('/sw.js')) return;

  // 版本檔：永遠向伺服器拿最新
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }

  // 網頁本身：先上網拿最新，離線才用快取
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // 其他資源（CSS／JS 帶版本號、圖示）：先用快取，沒有才上網並存起來
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }));
    }),
  );
});
