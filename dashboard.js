/* dashboard.js — 홈 대시보드: 날짜 자동 인식 위젯들 */
(function(){
  const DEP = new Date('2026-06-18T07:25:00+09:00');
  const END = new Date('2026-06-21T20:55:00+09:00');

  const weather = [
    {d:18, dow:'목', ic:'🌧️', tp:'24°', rn:'~50%'},
    {d:19, dow:'금', ic:'⛅', tp:'25°', rn:'~40%'},
    {d:20, dow:'토', ic:'🌥️', tp:'27°', rn:'변동'},
    {d:21, dow:'일', ic:'🌧️', tp:'24°', rn:'~90%'}
  ];
  const sched = {
    18:{t:'도착일 · 도쿄 입성', s:'스카이라이너로 닛포리 → 15:00 숙소 체크인'},
    19:{t:'종일 자유 일정', s:'4일 중 비 가장 적음 · 야외 일정 적기'},
    20:{t:'하코네 후보 / 자유', s:'비 여부 보고 당일 결정'},
    21:{t:'귀국일', s:'닛포리 → 나리타 · NRT 18:25 출발'}
  };

  function kstNow(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})); }
  function pad(n){ return String(n).padStart(2,'0'); }

  // ── D-day + 시계 ──
  const numEl = document.getElementById('dday-num');
  const labEl = document.getElementById('dday-label');
  const clkEl = document.getElementById('dday-clock');
  function seg(v,l){ return '<div class="seg"><b>'+pad(v)+'</b><span>'+l+'</span></div>'; }

  function tickCountdown(){
    const now = new Date();
    if(now < DEP){
      const k = kstNow();
      const today0 = new Date(k.getFullYear(), k.getMonth(), k.getDate());
      const dep0 = new Date(2026,5,18);
      const dDays = Math.round((dep0 - today0)/86400000);
      const ms = DEP - now;
      const h = Math.floor(ms/3600000)%24, m = Math.floor(ms/60000)%60, s = Math.floor(ms/1000)%60;
      numEl.innerHTML = 'D-'+dDays;
      labEl.textContent = '도쿄 출발까지 (6/18 07:25)';
      clkEl.innerHTML = seg(h,'시간')+seg(m,'분')+seg(s,'초');
    } else if(now <= END){
      const k = kstNow();
      const nth = k.getDate() - 17; // 18일=1일차
      numEl.innerHTML = nth+'<small>일차</small>';
      labEl.textContent = '도쿄 여행 중 ✈️';
      clkEl.innerHTML = '';
    } else {
      numEl.innerHTML = '完';
      labEl.textContent = '여행 종료 · 수고하셨어요!';
      clkEl.innerHTML = '';
    }
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // ── 날씨 미니 (오늘 강조) ──
  const wEl = document.getElementById('wmini');
  if(wEl){
    const k = kstNow(), td = (k.getFullYear()===2026 && k.getMonth()===5) ? k.getDate() : 0;
    wEl.innerHTML = weather.map(w=>
      '<div class="d'+(w.d===td?' on':'')+'"><div class="dd">'+w.dow+' '+w.d+'</div><div class="ic">'+w.ic+'</div><div class="tp">'+w.tp+'</div><div class="rn">'+w.rn+'</div></div>'
    ).join('');
  }

  // ── 오늘/다음 일정 ──
  const sNow = document.getElementById('smini-now');
  const sTit = document.getElementById('smini-title');
  const sSub = document.getElementById('smini-sub');
  if(sTit){
    const k = kstNow();
    const inJune = k.getFullYear()===2026 && k.getMonth()===5;
    const day = inJune ? k.getDate() : 0;
    if(day>=18 && day<=21){
      sNow.textContent = '오늘 · 6/'+day+'('+weather[day-18].dow+')';
      sTit.textContent = sched[day].t;
      sSub.textContent = sched[day].s;
    } else if(new Date() > END){
      sNow.textContent = '여행 종료';
      sTit.textContent = '집으로 안전 귀가 🏠';
      sSub.textContent = '다음 여행에서 또 만나요';
    } else {
      sNow.textContent = '다가오는 일정';
      sTit.textContent = '✈️ 도쿄 출발 (6/18 목)';
      sSub.textContent = 'ICN 07:25 · 스카이라이너로 닛포리 이동';
    }
  }

  // ── 준비물 진행률 ──
  const pPct = document.getElementById('prep-pct');
  const pSub = document.getElementById('prep-sub');
  if(pPct){
    let saved = {};
    try{ saved = JSON.parse(localStorage.getItem('tokyo-prep-checks')||'{}'); }catch(e){}
    const keys = Object.keys(saved);
    if(keys.length){
      const done = keys.filter(k=>saved[k]).length;
      pPct.textContent = Math.round(done/keys.length*100)+' %';
      pSub.textContent = done+' / '+keys.length+' 완료 · 체크리스트';
    } else {
      pPct.textContent = '시작 전';
      pSub.textContent = '준비물 체크리스트 →';
    }
  }

  // ── 환율 미니 (실시간) ──
  const rateEl = document.getElementById('fx-rate');
  const updEl = document.getElementById('fx-upd');
  const jpy = document.getElementById('fx-jpy');
  const krw = document.getElementById('fx-krw');
  let rate = 9.1, live = false;
  const fmt = n => isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '';
  function show(){
    rateEl.textContent = '100엔 = '+fmt(rate*100)+'원';
    updEl.textContent = live ? '실시간 환율' : '오프라인 추정값';
  }
  function fromJpy(){ const v=parseFloat(jpy.value); krw.value = v>=0 ? Math.round(v*rate) : ''; }
  function fromKrw(){ const v=parseFloat(krw.value); jpy.value = v>=0 ? Math.round(v/rate) : ''; }
  if(jpy && krw){
    // 입력칸을 누르면 타일 링크로 이동하지 않도록 (기본 이동 취소)
    const fxTile = jpy.closest('.tile');
    if(fxTile) fxTile.addEventListener('click', e=>{ if(e.target.closest('input')) e.preventDefault(); });
    jpy.addEventListener('input', fromJpy);
    krw.addEventListener('input', fromKrw);
    jpy.value = 1000;
    fetch('https://open.er-api.com/v6/latest/JPY').then(r=>r.json()).then(d=>{
      if(d && d.rates && d.rates.KRW){ rate=d.rates.KRW; live=true; }
      show(); fromJpy();
    }).catch(()=>{ show(); fromJpy(); });
    show(); fromJpy();
  }
})();
