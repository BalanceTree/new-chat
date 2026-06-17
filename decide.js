/* decide.js — 회의 안건 체크 상태 localStorage 저장 + 진행률 */
(function(){
  const KEY = 'tokyo-decide';
  const boxes = Array.from(document.querySelectorAll('.dc input[type=checkbox]'));
  const bar = document.querySelector('.dc-hero .pbar i');
  const txt = document.querySelector('.dc-hero .ptxt');
  const reset = document.getElementById('dc-reset');

  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){ saved = {}; }

  function update(){
    const done = boxes.filter(b=>b.checked).length;
    const pct = boxes.length ? Math.round(done/boxes.length*100) : 0;
    if(bar) bar.style.width = pct + '%';
    if(txt) txt.textContent = '확정 ' + done + ' / ' + boxes.length + ' (' + pct + '%) · 남은 안건 ' + (boxes.length-done) + '개';
  }
  function save(){
    const s = {};
    boxes.forEach(b=>{ s[b.id] = b.checked; });
    try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
  }
  boxes.forEach(b=>{
    if(saved[b.id]) b.checked = true;
    b.addEventListener('change', ()=>{ save(); update(); });
  });
  update();
  if(reset) reset.addEventListener('click', ()=>{ boxes.forEach(b=> b.checked=false); save(); update(); });
})();
