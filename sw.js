// وزن — يعمل بلا إنترنت. الكود يُجلب من الشبكة أولاً (لتصل التحديثات فوراً)، والقاموس من المخزن أولاً
const CACHE = 'wazn-v1.4.1';
const DIWANS = 'wazn-diwans';   // الدواوين تُخزَّن حين تُفتح، ولا تُحذف مع التحديثات
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'worker.js', 'manifest.webmanifest',
  'src/arabic.js', 'src/meters.js', 'src/engine.js', 'src/ai.js', 'src/explain.js', 'src/diwans.js', 'data/dict.tsv', 'data/mukhtarat.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== DIWANS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/data/dict.tsv')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    return;
  }
  // الدواوين: من المخزن فوراً، وتُجدَّد في الخلفية
  if (url.pathname.includes('/data/diwans/')) {
    e.respondWith(caches.open(DIWANS).then(c => c.match(e.request).then(hit => {
      const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })));
    return;
  }
  // الشبكة أولاً، والمخزن عند انقطاع الاتصال
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))));
});
