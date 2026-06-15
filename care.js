/* care.js — 성은 케어: 체크리스트 저장 + 인공눈물 타이머 */
(function () {

  /* ── 체크리스트 저장/복원 ── */
  const STORE_KEY = 'tokyo-care-checks';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) {}

  document.querySelectorAll('.care-chk input[type="checkbox"]').forEach(cb => {
    if (saved[cb.id]) cb.checked = true;
    cb.addEventListener('change', () => {
      saved[cb.id] = cb.checked;
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    });
  });

  /* ── Service Worker 등록 (백그라운드 알림용) ── */
  let swReady = null;
  if ('serviceWorker' in navigator) {
    swReady = navigator.serviceWorker.register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }

  async function scheduleSwNotification(minutes) {
    if (!swReady) return;
    const reg = await swReady;
    if (!reg || !reg.active) return;
    reg.active.postMessage({
      type: 'SCHEDULE',
      delay: minutes * 60 * 1000,
      body: `💧 인공눈물 넣을 시간! (${minutes}분 경과)`,
    });
  }

  async function cancelSwNotification() {
    if (!swReady) return;
    const reg = await swReady;
    if (!reg || !reg.active) return;
    reg.active.postMessage({ type: 'CANCEL' });
  }

  /* 알림 권한 요청 + SW 예약 */
  async function requestAndSchedule(minutes) {
    if (!('Notification' in window)) return;
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    updateNotiBadge(perm);
    if (perm === 'granted') {
      await scheduleSwNotification(minutes);
    }
  }

  /* ── 알림 상태 배지 ── */
  function updateNotiBadge(perm) {
    const badge = document.getElementById('noti-badge');
    if (!badge) return;
    if (perm === 'granted') {
      badge.textContent = '🔔 알림 켜짐 · 탭 닫아도 OK';
      badge.className = 'noti-badge on';
    } else if (perm === 'denied') {
      badge.textContent = '🔕 알림 차단됨 · 브라우저 설정에서 허용 필요';
      badge.className = 'noti-badge off';
    } else {
      badge.textContent = '🔔 타이머 시작 시 알림 권한 요청';
      badge.className = 'noti-badge idle';
    }
  }

  if ('Notification' in window) updateNotiBadge(Notification.permission);

  /* ── 인공눈물 타이머 ── */
  const display  = document.getElementById('timer-display');
  const status   = document.getElementById('timer-status');
  const btn30    = document.getElementById('btn-30');
  const btn60    = document.getElementById('btn-60');
  const btnReset = document.getElementById('btn-reset');

  let remaining = 0, intervalId = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    display.textContent = pad(m) + ':' + pad(s);
    display.classList.toggle('urgent', remaining <= 60 && remaining > 0);
  }

  function startTimer(minutes) {
    clearInterval(intervalId);
    remaining = minutes * 60;
    [btn30, btn60].forEach(b => b.classList.remove('active'));
    (minutes === 30 ? btn30 : btn60).classList.add('active');
    display.classList.remove('urgent');
    status.textContent = '타이머 진행 중…';
    status.className = 'timer-status running';
    render();

    /* 백그라운드 알림 예약 */
    requestAndSchedule(minutes);

    intervalId = setInterval(() => {
      remaining--;
      render();
      if (remaining <= 0) {
        clearInterval(intervalId);
        display.textContent = '00:00';
        status.textContent = '💧 인공눈물 넣을 시간이에요!';
        status.className = 'timer-status done';
        [btn30, btn60].forEach(b => b.classList.remove('active'));
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
        /* 페이지 열려 있을 때도 알림 */
        if (Notification.permission === 'granted') {
          new Notification('💧 인공눈물 타이머', {
            body: `인공눈물 넣을 시간! (${Math.round(remaining / 60) || minutes}분)`,
            icon: './favicon.svg',
            tag: 'eyedrop-timer',
          });
        }
      }
    }, 1000);
  }

  function reset() {
    clearInterval(intervalId);
    remaining = 0;
    display.textContent = '30:00';
    display.classList.remove('urgent');
    status.textContent = '타이머를 눌러 시작하세요';
    status.className = 'timer-status';
    [btn30, btn60].forEach(b => b.classList.remove('active'));
    cancelSwNotification();
  }

  btn30.addEventListener('click', () => startTimer(30));
  btn60.addEventListener('click', () => startTimer(60));
  btnReset.addEventListener('click', reset);

})();
