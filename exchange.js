/* exchange.js — 실시간 엔↔원 환율 계산기 (open.er-api.com, 무료·키 불필요) */
(function(){
  const root = document.getElementById('fx');
  if(!root) return;

  const jpy = root.querySelector('#fx-jpy');
  const krw = root.querySelector('#fx-krw');
  const rateTxt = root.querySelector('#fx-rate');
  const updTxt = root.querySelector('#fx-upd');
  const chips = root.querySelectorAll('.fx-chip');
  const refresh = root.querySelector('#fx-refresh');

  const FALLBACK = 9.1; // 100엔 ≈ 910원 근사 (오프라인 대비)
  let rate = FALLBACK;       // 1 JPY = rate KRW
  let live = false;

  const fmt = n => isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '';

  function showRate(){
    rateTxt.textContent = '100엔 = ' + fmt(rate*100) + '원';
    updTxt.textContent = live ? ('실시간 · ' + new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})) : '오프라인 추정값';
    updTxt.classList.toggle('off', !live);
  }
  function fromJpy(){ const v=parseFloat(jpy.value); krw.value = v>=0 ? Math.round(v*rate) : ''; }
  function fromKrw(){ const v=parseFloat(krw.value); jpy.value = v>=0 ? Math.round(v/rate) : ''; }

  async function load(){
    updTxt.textContent = '불러오는 중…';
    try{
      const r = await fetch('https://open.er-api.com/v6/latest/JPY');
      const data = await r.json();
      if(data && data.rates && data.rates.KRW){
        rate = data.rates.KRW; live = true;
      }
    }catch(e){ live = false; }
    showRate();
    if(jpy.value) fromJpy();
  }

  jpy.addEventListener('input', fromJpy);
  krw.addEventListener('input', fromKrw);
  chips.forEach(c=> c.addEventListener('click', ()=>{ jpy.value = c.dataset.jpy; fromJpy(); }));
  if(refresh) refresh.addEventListener('click', load);

  jpy.value = 1000; showRate(); fromJpy();
  load();
})();
