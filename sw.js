/* sw.js — 인공눈물 타이머 알림 + PWA 오프라인 캐싱 */
const CACHE = 'tokyo-trip-v4';
const ASSETS = [
  './','./index.html','./weather.html','./travel.html','./itinerary.html',
  './prep.html','./stay.html','./care.html','./decide.html','./money.html',
  './style.css','./dashboard.css','./travel.css','./itinerary.css','./prep.css',
  './stay.css','./care.css','./decide.css','./money.css',
  './common.js','./dashboard.js','./rain.js','./weather-api.js','./accordion.js',
  './prep.js','./exchange.js','./stay.js','./care.js','./decide.js','./money.js',
  './favicon.svg','./manifest.json','./icon-192.png','./icon-512.png','./icon-180.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

/* 네트워크 우선, 실패 시 캐시 (오프라인 대비) — 외부 API는 통과 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(날씨·환율 API 등)는 그대로
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

/* 타이머 스케줄 메시지 수신 */
self.addEventListener('message', event => {
  const { type, delay, body } = event.data || {};

  if (type === 'SCHEDULE') {
    /* event.waitUntil → 타이머 완료까지 SW 생존 보장 */
    event.waitUntil(
      new Promise(resolve => {
        /* 기존 타이머 취소 플래그 */
        self._timerId = (self._timerId || 0) + 1;
        const myId = self._timerId;

        setTimeout(() => {
          if (self._timerId !== myId) return resolve(); // 리셋됐으면 취소
          self.registration.showNotification('💧 인공눈물 타이머', {
            body: body || '인공눈물 넣을 시간이에요!',
            icon: './favicon.svg',
            badge: './favicon.svg',
            vibrate: [400, 100, 400, 100, 400],
            tag: 'eyedrop-timer',
            requireInteraction: true,
            actions: [{ action: 'ok', title: '✅ 넣었어요' }],
          }).then(resolve).catch(resolve);
        }, delay);
      })
    );
  }

  if (type === 'CANCEL') {
    /* 버전 올려서 기존 타이머 무효화 */
    self._timerId = (self._timerId || 0) + 1;
  }
});

/* 알림 액션 클릭 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'ok') return;
  /* 알림 클릭 시 care 페이지 포커스 */
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const target = clients.find(c => c.url.includes('care'));
      if (target) return target.focus();
      return self.clients.openWindow('./care.html');
    })
  );
});
