/* prep.js — 체크리스트 상태를 localStorage에 저장 + 진행률 표시 */
(function(){
  const KEY = 'tokyo-prep-checks';
  const boxes = Array.from(document.querySelectorAll('.chk input[type=checkbox]'));
  const bar = document.querySelector('.pbar i');
  const txt = document.querySelector('.ptxt');
  const reset = document.getElementById('resetChecks');

  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){ saved = {}; }

  function update(){
    const done = boxes.filter(b=>b.checked).length;
    const pct = boxes.length ? Math.round(done/boxes.length*100) : 0;
    if(bar) bar.style.width = pct + '%';
    if(txt) txt.textContent = done + ' / ' + boxes.length + ' 완료 (' + pct + '%)';
  }
  function save(){
    const state = {};
    boxes.forEach(b=>{ state[b.id] = b.checked; });
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
  }

  boxes.forEach(b=>{
    if(saved[b.id]) b.checked = true;
    b.addEventListener('change', ()=>{ save(); update(); });
  });
  update();

  if(reset) reset.addEventListener('click', ()=>{
    boxes.forEach(b=> b.checked = false);
    save(); update();
  });
})();

/* 크루 메모 — 4명 각자 한 칸 · Supabase 공유(미설정 시 이 기기 저장) */
(function(){
  const SUPABASE_URL = 'https://srxnnccuxnfhnantmrxr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeG5uY2N1eG5maG5hbnRtcnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTc4MTUsImV4cCI6MjA5NzIzMzgxNX0.mMbbrkuC_ScOXLdsPmzMduOT1k-9KEK6C7wrZ9kcMME';
  const TRIP = 'tokyo';
  const MEMBERS = ['곽성은','장진혁','한창섭','윤여찬'];
  const SHARED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const LS_KEY = (i)=>'tokyo-memo-'+i;
  const tas = Array.from(document.querySelectorAll('.memo-ta'));
  if(!tas.length) return;
  const conn = document.getElementById('memo-conn');

  function headers(extra){
    return Object.assign({
      apikey: SUPABASE_ANON_KEY,
      authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      'content-type': 'application/json'
    }, extra||{});
  }
  function setStatus(ta, msg, ok){
    const s = ta.closest('.memo-card').querySelector('[data-status]');
    if(!s) return;
    s.textContent = msg; s.style.opacity = '1';
    s.style.color = ok===false ? 'var(--bad)' : 'var(--good)';
    if(msg==='✓ 저장됨') setTimeout(()=>{ s.style.opacity='0'; }, 1500);
  }

  async function loadAll(){
    let rows = [];
    if(SHARED){
      try{
        const r = await fetch(`${SUPABASE_URL}/rest/v1/crew_memos?trip=eq.${TRIP}&select=member,body`, { headers: headers() });
        if(r.ok) rows = await r.json();
        else throw new Error(''+r.status);
      }catch(e){ if(conn) conn.textContent = '오프라인 · 이 기기 저장 중'; }
    }
    tas.forEach(ta=>{
      const i = +ta.dataset.memo;
      const row = rows.find(x=>x.member===i);
      ta.value = (row && row.body) || localStorage.getItem(LS_KEY(i)) || '';
    });
  }

  async function saveOne(ta){
    const i = +ta.dataset.memo;
    localStorage.setItem(LS_KEY(i), ta.value);
    if(!SHARED) { setStatus(ta, '✓ 저장됨'); return; }
    try{
      const body = { trip: TRIP, member: i, name: MEMBERS[i], body: ta.value, updated_at: new Date().toISOString() };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/crew_memos?on_conflict=trip,member`, {
        method: 'POST',
        headers: headers({ prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(body)
      });
      if(!r.ok) throw new Error(''+r.status);
      setStatus(ta, '✓ 저장됨');
    }catch(e){ setStatus(ta, '⚠ 저장 실패(이 기기엔 보관)', false); }
  }

  const timers = {};
  tas.forEach(ta=>{
    ta.addEventListener('input', ()=>{
      const i = ta.dataset.memo;
      setStatus(ta, '저장 중…');
      clearTimeout(timers[i]);
      timers[i] = setTimeout(()=> saveOne(ta), 600);
    });
  });

  loadAll();
})();
