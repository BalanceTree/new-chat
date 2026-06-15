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

/* 개인 메모 */
(function(){
  const MEMO_KEY = 'tokyo-personal-memo';
  const ta = document.getElementById('memo-text');
  const saved = document.getElementById('memo-saved');
  const clear = document.getElementById('memo-clear');
  if(!ta) return;

  ta.value = localStorage.getItem(MEMO_KEY) || '';

  let timer;
  ta.addEventListener('input', ()=>{
    localStorage.setItem(MEMO_KEY, ta.value);
    clearTimeout(timer);
    saved.style.opacity = '1';
    saved.textContent = '✓ 저장됨';
    timer = setTimeout(()=>{ saved.style.opacity = '0'; }, 1500);
  });

  if(clear) clear.addEventListener('click', ()=>{
    if(!ta.value || confirm('메모를 초기화할까요?')) {
      ta.value = '';
      localStorage.removeItem(MEMO_KEY);
      saved.textContent = '초기화됨';
      saved.style.opacity = '1';
      setTimeout(()=>{ saved.style.opacity = '0'; }, 1500);
    }
  });
})();
