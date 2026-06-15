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

  /* ── 인공눈물 타이머 ── */
  const display = document.getElementById('timer-display');
  const status  = document.getElementById('timer-status');
  const btn30   = document.getElementById('btn-30');
  const btn60   = document.getElementById('btn-60');
  const btnReset = document.getElementById('btn-reset');

  let total = 0, remaining = 0, intervalId = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    display.textContent = pad(m) + ':' + pad(s);
    display.classList.toggle('urgent', remaining <= 60 && remaining > 0);
  }

  function startTimer(minutes) {
    clearInterval(intervalId);
    total = minutes * 60;
    remaining = total;
    [btn30, btn60].forEach(b => b.classList.remove('active'));
    (minutes === 30 ? btn30 : btn60).classList.add('active');
    display.classList.remove('urgent');
    status.textContent = '타이머 진행 중…';
    status.className = 'timer-status running';
    render();

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
  }

  btn30.addEventListener('click', () => startTimer(30));
  btn60.addEventListener('click', () => startTimer(60));
  btnReset.addEventListener('click', reset);

})();
