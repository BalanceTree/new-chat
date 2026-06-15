/* sw.js — 인공눈물 타이머 알림 전용 Service Worker */
const CACHE = 'tokyo-trip-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
