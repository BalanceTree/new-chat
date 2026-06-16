/* dashboard.js — 홈 대시보드 (여행 전/중/후 3단계) */
(function(){
  /* ── 상수 ── */
  const DEP = new Date('2026-06-18T07:25:00+09:00'); // 이륙
  const END = new Date('2026-06-21T20:55:00+09:00'); // 인천 도착
  const TRIP_START = new Date('2026-06-18T03:55:00+09:00'); // 픽업 시작 = 여행 시작

  /* ── 시간대별 상태 데이터 ── */
  const ACTS = {
    18:[
      { from:'00:00', to:'03:55', ic:'🛏️', state:'마지막 꿀잠', sub:'잠깐이라도 자둬요' },
      { from:'03:55', to:'05:15', ic:'🚗', state:'픽업 이동 중', sub:'인계동 → 매탄동 → 서호서로 → 공항' },
      { from:'05:15', to:'05:40', ic:'🅿️', state:'인천공항 도착', sub:'T1 장기주차 → 셔틀 이동' },
      { from:'05:40', to:'07:10', ic:'🎫', state:'탑승 준비 중', sub:'카운터 집결 → 보안검색 → 게이트' },
      { from:'07:10', to:'07:25', ic:'🛫', state:'곧 이륙!', sub:'ZE0605 · 07:25 출발 — 제 자리 찾기' },
      { from:'07:25', to:'09:50', ic:'✈️', state:'비행 중!', sub:'ICN → NRT · 약 2시간 25분' },
      { from:'09:50', to:'11:30', ic:'🛬', state:'나리타 도착', sub:'입국심사 · 수하물 수령 · 스카이라이너' },
      { from:'11:30', to:'15:00', ic:'🚆', state:'도쿄 입성!', sub:'닛포리 도착 · 점심 · 숙소 짐 맡기기' },
      { from:'15:00', to:'23:59', ic:'🏠', state:'숙소 체크인 완료', sub:'앨리스 도쿄 스테이 · 3박 4일 시작' },
    ],
    19:[
      { from:'00:00', to:'08:00', ic:'🛏️', state:'수면 중', sub:'도쿄 첫날 밤' },
      { from:'08:00', to:'23:59', ic:'🏖️', state:'자유 일정', sub:'에노시마 · 시부야 · 4일 중 야외 적기' },
    ],
    20:[
      { from:'00:00', to:'08:00', ic:'🛏️', state:'수면 중', sub:'3일차 밤' },
      { from:'08:00', to:'23:59', ic:'❓', state:'자유 일정', sub:'하코네 or 도쿄 시내 · 당일 결정' },
    ],
    21:[
      { from:'00:00', to:'08:00', ic:'🛏️', state:'마지막 밤', sub:'오늘 귀국이에요' },
      { from:'08:00', to:'12:00', ic:'🧳', state:'짐 싸는 중', sub:'체크아웃 12:00 전 완료' },
      { from:'12:00', to:'15:30', ic:'🗼', state:'마지막 도쿄', sub:'실내·쇼핑 위주 · 종일 비 유력' },
      { from:'15:30', to:'18:00', ic:'🚆', state:'나리타 이동 중', sub:'스카이라이너 → T1 출국장' },
      { from:'18:00', to:'18:25', ic:'🛫', state:'곧 이륙!', sub:'LJ0210 · 18:25 출발' },
      { from:'18:25', to:'20:55', ic:'✈️', state:'귀국 비행 중!', sub:'NRT → ICN · 약 2시간 30분' },
      { from:'20:55', to:'23:59', ic:'🏠', state:'귀국 완료!', sub:'수원권 역순 드랍 · 수고하셨어요 🎉' },
    ],
  };

  const WEATHER_FB = [
    {d:18,dow:'목',ic:'🌧️',tp:'24°',rn:'~50%'},
    {d:19,dow:'금',ic:'⛅', tp:'25°',rn:'~40%'},
    {d:20,dow:'토',ic:'🌥️',tp:'27°',rn:'변동'},
    {d:21,dow:'일',ic:'🌧️',tp:'24°',rn:'~90%'},
  ];
  const SCHED = {
    18:{t:'도착일 · 도쿄 입성',   s:'스카이라이너로 닛포리 → 15:00 체크인'},
    19:{t:'종일 자유 일정',       s:'4일 중 비 가장 적음 · 야외 일정 적기'},
    20:{t:'하코네 후보 / 자유',   s:'비 여부 보고 당일 결정'},
    21:{t:'귀국일',               s:'닛포리 → 나리타 · NRT 18:25 출발'},
  };

  /* ── 유틸 ── */
  function kst(){ return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function toMin(hhmm){ const [h,m]=hhmm.split(':').map(Number); return h*60+m; }
  function minutesNow(){ const k=kst(); return k.getHours()*60+k.getMinutes(); }
  function seg(v,l){ return `<div class="seg"><b>${pad(v)}</b><span>${l}</span></div>`; }

  /* ── 현재 여행 모드 판별 ── */
  const now = new Date();
  const MODE = now < TRIP_START ? 'PRE' : now <= END ? 'IN' : 'POST';
  const k = kst();
  const dayNum = k.getDate(); // 18~21

  /* ══════════════════════════════
     PRE 모드 — 디데이 카운트다운
  ══════════════════════════════ */
  const numEl = document.getElementById('dday-num');
  const labEl = document.getElementById('dday-label');
  const clkEl = document.getElementById('dday-clock');

  if(MODE === 'PRE'){
    function tickPre(){
      const n=new Date();
      const today0=new Date(kst().getFullYear(),kst().getMonth(),kst().getDate());
      const dep0=new Date(2026,5,18);
      const dDays=Math.round((dep0-today0)/86400000);
      const ms=DEP-n, h=Math.floor(ms/3600000)%24, m=Math.floor(ms/60000)%60, s=Math.floor(ms/1000)%60;
      numEl.innerHTML='D-'+dDays;
      labEl.textContent='도쿄 출발까지 (6/18 07:25)';
      clkEl.innerHTML=seg(h,'시간')+seg(m,'분')+seg(s,'초');
    }
    tickPre(); setInterval(tickPre,1000);

    /* 날씨 미니 */
    const wEl=document.getElementById('wmini');
    if(wEl) wEl.innerHTML=WEATHER_FB.map(w=>
      `<div class="d"><div class="dd">${w.dow} ${w.d}</div><div class="ic">${w.ic}</div><div class="tp">${w.tp}</div><div class="rn">${w.rn}</div></div>`
    ).join('');

    /* 일정 미니 */
    const sTit=document.getElementById('smini-title'), sSub=document.getElementById('smini-sub'), sNow=document.getElementById('smini-now');
    if(sTit){ sNow.textContent='다가오는 일정'; sTit.textContent='✈️ 도쿄 출발 (6/18 목)'; sSub.textContent='ICN 07:25 · 스카이라이너로 닛포리 이동'; }

    renderPrepProgress();
    renderFx();
    return; // PRE 모드 끝
  }

  /* ══════════════════════════════
     POST 모드 — 여행 종료
  ══════════════════════════════ */
  if(MODE === 'POST'){
    numEl.innerHTML='完';
    labEl.textContent='여행 종료 · 수고하셨어요!';
    clkEl.innerHTML='';
    const sTit=document.getElementById('smini-title'), sSub=document.getElementById('smini-sub'), sNow=document.getElementById('smini-now');
    if(sTit){ sNow.textContent='여행 종료'; sTit.textContent='집으로 안전 귀가 🏠'; sSub.textContent='다음 여행에서 또 만나요'; }
    renderFx();
    return;
  }

  /* ══════════════════════════════
     IN 모드 — 여행 중 대시보드
  ══════════════════════════════ */
  const tripNth = dayNum - 17; // 18일=1일차

  /* 여행 경과율 */
  const tripTotalMs = END - TRIP_START;
  const tripElapsedMs = now - TRIP_START;
  const tripPct = Math.min(100, Math.max(0, Math.round(tripElapsedMs/tripTotalMs*100)));

  /* 현재 활동 */
  const acts = ACTS[dayNum] || [];
  const mn = minutesNow();
  let curAct = acts[acts.length-1];
  let nextAct = null;
  for(let i=0; i<acts.length; i++){
    if(mn >= toMin(acts[i].from) && mn < toMin(acts[i].to)){
      curAct = acts[i]; nextAct = acts[i+1]||null; break;
    }
  }

  /* 다음 이벤트까지 분 계산 */
  function minsToNext(){
    if(!nextAct) return null;
    return toMin(nextAct.from) - mn;
  }

  /* ── 히어로 → 여행 중 모드 ── */
  numEl.innerHTML = `${tripNth}<small>일차</small>`;
  labEl.textContent = '도쿄 여행 중 ✈️';

  // 시계 → 현재 상태 + 진행률
  clkEl.innerHTML = '';
  const heroExtra = document.getElementById('hero-trip');
  if(heroExtra){
    heroExtra.style.display = 'block';
    heroExtra.innerHTML = `
      <div class="trip-state">
        <span class="ts-ic">${curAct.ic}</span>
        <div class="ts-txt">
          <b>${curAct.state}</b>
          <small>${curAct.sub}</small>
        </div>
      </div>
      <div class="trip-prog">
        <div class="tp-bar"><div class="tp-fill" style="width:${tripPct}%"></div></div>
        <div class="tp-label">${tripPct}% 완료 · ${4-tripNth}일 남음</div>
      </div>
    `;
  }

  // 히어로 라이브 업데이트 (1분마다)
  setInterval(()=>{
    const mn2=minutesNow(), n2=new Date();
    const acts2=ACTS[kst().getDate()]||[];
    let ca=acts2[acts2.length-1];
    for(const a of acts2){ if(mn2>=toMin(a.from)&&mn2<toMin(a.to)){ca=a;break;} }
    const pct2=Math.min(100,Math.round((n2-TRIP_START)/tripTotalMs*100));
    const tsIc=heroExtra?.querySelector('.ts-ic'), tsTxt=heroExtra?.querySelector('.ts-txt');
    if(tsIc) tsIc.textContent=ca.ic;
    if(tsTxt) tsTxt.innerHTML=`<b>${ca.state}</b><small>${ca.sub}</small>`;
    const fill=heroExtra?.querySelector('.tp-fill'), lbl=heroExtra?.querySelector('.tp-label');
    if(fill) fill.style.width=pct2+'%';
    if(lbl) lbl.textContent=`${pct2}% 완료 · ${4-tripNth}일 남음`;
  }, 60000);

  /* ── 오늘 타임라인 타일 ── */
  const tlTile = document.getElementById('today-tl');
  if(tlTile){
    tlTile.style.display = 'block';
    const tlContent = document.getElementById('tl-content');
    if(tlContent){
      tlContent.innerHTML = acts.map((a,i)=>{
        const isPast = mn >= toMin(a.to);
        const isCur  = mn >= toMin(a.from) && mn < toMin(a.to);
        const cls    = isPast ? 'tl-past' : isCur ? 'tl-cur' : 'tl-fut';
        return `
          <div class="tl-row ${cls}">
            <div class="tl-ic">${a.ic}</div>
            <div class="tl-body">
              <div class="tl-time">${a.from}</div>
              <div class="tl-state">${a.state}</div>
              <div class="tl-sub">${a.sub}</div>
            </div>
            ${isCur ? '<div class="tl-now-badge">지금</div>' : ''}
          </div>`;
      }).join('');
    }
  }

  /* ── 날씨 타일 → 오늘 강조 ── */
  const wEl = document.getElementById('wmini');
  if(wEl){
    wEl.innerHTML = WEATHER_FB.map(w=>
      `<div class="d${w.d===dayNum?' on':''}">
        <div class="dd">${w.dow} ${w.d}</div>
        <div class="ic">${w.ic}</div>
        <div class="tp">${w.tp}</div>
        <div class="rn">${w.rn}</div>
      </div>`
    ).join('');
    // 실시간 날씨 (오늘만 간소 호출)
    const todayStr = `2026-06-${pad(dayNum)}`;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=precipitation_probability_max,temperature_2m_max,weathercode&timezone=Asia%2FTokyo&start_date=${todayStr}&end_date=${todayStr}&models=jma_seamless`)
      .then(r=>r.json()).then(d=>{
        const p=d.daily?.precipitation_probability_max?.[0], t=d.daily?.temperature_2m_max?.[0];
        const todayEl=wEl.querySelector('.d.on .tp');
        const rainEl=wEl.querySelector('.d.on .rn');
        if(todayEl && t!=null) todayEl.textContent=Math.round(t)+'°';
        if(rainEl  && p!=null) rainEl.textContent='비 '+Math.round(p)+'%';
      }).catch(()=>{});
  }

  /* ── 일정 타일 → 현재/다음 ── */
  const sNow=document.getElementById('smini-now'), sTit=document.getElementById('smini-title'), sSub=document.getElementById('smini-sub');
  if(sTit){
    const mins2Next = minsToNext();
    if(nextAct && mins2Next!=null){
      sNow.textContent = `지금 · ${curAct.ic} ${curAct.state}`;
      sTit.textContent = `다음: ${nextAct.ic} ${nextAct.state}`;
      sSub.textContent = `${nextAct.from} · ${mins2Next}분 후`;
    } else {
      sNow.textContent = '지금';
      sTit.textContent = `${curAct.ic} ${curAct.state}`;
      sSub.textContent = curAct.sub;
    }
  }

  /* ── 준비물 타일 → 여행 진행률 ── */
  const pPct=document.getElementById('prep-pct'), pSub=document.getElementById('prep-sub');
  const prepTileNm = document.querySelector('#prep-tile .nm');
  if(pPct){
    if(prepTileNm) prepTileNm.textContent='📅 여행 진행률';
    pPct.textContent = tripPct + ' %';
    pSub.textContent = `${tripNth}일차 진행 중 · ${4-tripNth}일 남음`;
  }

  /* ── 항공 타일 → 숙소 상태로 교체 ── */
  const flightTile = document.getElementById('flight-tile');
  if(flightTile){
    const cin  = new Date('2026-06-18T15:00:00+09:00');
    const cout = new Date('2026-06-21T12:00:00+09:00');
    const isCheckedIn  = now >= cin;
    const isCheckedOut = now >= cout;
    let stayHTML = `<div class="stay-mini">`;
    if(!isCheckedIn){
      const ms=cin-now, h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60;
      stayHTML += `<div class="sm-badge sm-soon">체크인까지 ${h}시간 ${m}분</div>`;
    } else if(!isCheckedOut){
      const ms=cout-now, h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60;
      stayHTML += `<div class="sm-badge sm-in">✅ 체크인 완료 · 체크아웃까지 ${h}시간 ${m}분</div>`;
    } else {
      stayHTML += `<div class="sm-badge sm-out">체크아웃 완료</div>`;
    }
    stayHTML += `
      <div class="sm-row"><span>숙소</span><span>앨리스 도쿄 스테이 · 닛포리</span></div>
      <div class="sm-row"><span>체크인</span><span>6/18 15:00~24:00</span></div>
      <div class="sm-row"><span>체크아웃</span><span>6/21 12:00 전</span></div>
      <div class="sm-row"><span>교통</span><span>🚆 스카이라이너 · 닛포리역 근처</span></div>
    </div>`;
    const nm = flightTile.querySelector('.nm');
    const fmini = flightTile.querySelector('.fmini');
    if(nm) nm.textContent = '🏨 숙소 현황';
    if(fmini) fmini.outerHTML = stayHTML;
  }

  renderFx();

  /* ── 공통: 환율 + 차트 ── */
  function renderFx(){
    const rateEl=document.getElementById('fx-rate'), updEl=document.getElementById('fx-upd');
    const chartEl=document.getElementById('fx-chart');
    const jpyEl=document.getElementById('fx-jpy'), krwEl=document.getElementById('fx-krw');
    let rate=9.1, live=false;
    const fmt=n=>isFinite(n)?Math.round(n).toLocaleString('ko-KR'):'';
    const fmtDate=d=>d.toISOString().slice(0,10);

    function show(){
      if(rateEl) rateEl.textContent='100엔 = '+fmt(rate*100)+'원';
      if(updEl) updEl.textContent=live?'실시간':'오프라인';
    }
    function fromJpy(){ const v=parseFloat(jpyEl?.value); if(krwEl&&v>=0) krwEl.value=Math.round(v*rate); }
    function fromKrw(){ const v=parseFloat(krwEl?.value); if(jpyEl&&v>=0) jpyEl.value=Math.round(v/rate); }

    if(jpyEl&&krwEl){
      const fxTile=jpyEl.closest('.tile');
      if(fxTile) fxTile.addEventListener('click',e=>{ if(e.target.closest('input')) e.preventDefault(); });
      jpyEl.addEventListener('input',fromJpy); krwEl.addEventListener('input',fromKrw);
      jpyEl.value=1000;
      show(); fromJpy();
    }

    const today=new Date(), past=new Date(today-15*86400000);
    Promise.all([
      fetch('https://open.er-api.com/v6/latest/JPY').then(r=>r.json()).catch(()=>null),
      fetch('https://api.frankfurter.app/'+fmtDate(past)+'..'+fmtDate(today)+'?from=JPY&to=KRW').then(r=>r.json()).catch(()=>null)
    ]).then(([liveD,histD])=>{
      if(liveD?.rates?.KRW){ rate=liveD.rates.KRW; live=true; }
      show(); fromJpy();

      let pts=[];
      if(histD?.rates){
        pts=Object.entries(histD.rates)
          .sort(([a],[b])=>a.localeCompare(b))
          .map(([date,r])=>({ date, rate:(r.KRW||0)*100 }));
      }
      if(live && rate){
        const ts=fmtDate(today);
        if(pts.length && pts[pts.length-1].date===ts) pts[pts.length-1].rate=rate*100;
        else pts.push({ date:ts, rate:rate*100 });
      }
      if(chartEl && pts.length>=2) drawFxChart(pts,chartEl);
    });
  }

  function drawFxChart(points,el){
    const W=260,H=68;
    const vals=points.map(p=>p.rate), n=vals.length;
    const minV=Math.min(...vals), maxV=Math.max(...vals);
    const rng=maxV-minV||0.5;
    const isUp=vals[n-1]>=vals[0];
    const color=isUp?'#43d9a3':'#ff7070';
    const gid='fg'+Math.random().toString(36).slice(2,7);

    function px(i){ return (i/(n-1))*W; }
    function py(v){ return H-6-((v-minV)/rng)*(H-14); }

    let line=`M${px(0).toFixed(1)},${py(vals[0]).toFixed(1)}`;
    for(let i=1;i<n;i++){
      const x0=px(i-1),y0=py(vals[i-1]),x1=px(i),y1=py(vals[i]),cx=(x0+x1)/2;
      line+=` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    const fill=line+` L${px(n-1).toFixed(1)},${H} L0,${H} Z`;
    const pct=(vals[n-1]-vals[0])/vals[0]*100;
    const pctStr=(pct>=0?'+':'')+pct.toFixed(2)+'%';
    const endX=px(n-1).toFixed(1), endY=py(vals[n-1]).toFixed(1);

    el.innerHTML=`
      <div class="fx-meta">
        <span class="fx-period">${n}거래일</span>
        <span class="fx-chg ${isUp?'up':'dn'}">${pctStr}</span>
      </div>
      <div class="fx-svg-wrap">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="fx-svg" id="fx-svg-el">
          <defs>
            <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
              <stop offset="90%" stop-color="${color}" stop-opacity="0.01"/>
            </linearGradient>
          </defs>
          <path d="${fill}" fill="url(#${gid})"/>
          <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${endX}" cy="${endY}" r="3.5" fill="${color}" stroke="var(--night)" stroke-width="1.8"/>
        </svg>
      </div>`;

    /* 호버/터치 → 날짜·값 툴팁 */
    const svg=el.querySelector('.fx-svg');
    const metaEl=el.querySelector('.fx-meta');
    let hLine=null, origMeta=metaEl.innerHTML;

    function onMove(e){
      const r=svg.getBoundingClientRect();
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const ratio=Math.max(0,Math.min(1,(cx-r.left)/r.width));
      const idx=Math.round(ratio*(n-1));
      const pt=points[idx], v=vals[idx];
      /* 수직선 */
      if(!hLine){
        hLine=document.createElementNS('http://www.w3.org/2000/svg','line');
        hLine.setAttribute('stroke','rgba(255,255,255,.25)');
        hLine.setAttribute('stroke-width','1');
        hLine.setAttribute('stroke-dasharray','3,3');
        svg.appendChild(hLine);
      }
      const hx=px(idx).toFixed(1);
      hLine.setAttribute('x1',hx);hLine.setAttribute('x2',hx);
      hLine.setAttribute('y1',0);hLine.setAttribute('y2',H);
      /* 메타 교체 */
      const diff=v-vals[0], ds=(diff>=0?'+':'')+diff.toFixed(0)+'원';
      metaEl.innerHTML=`<span class="fx-period">${pt.date.slice(5)}</span><span class="fx-chg ${diff>=0?'up':'dn'}">${Math.round(v).toLocaleString('ko-KR')}원 (${ds})</span>`;
    }
    function onLeave(){
      if(hLine){hLine.remove();hLine=null;}
      metaEl.innerHTML=origMeta;
    }
    svg.addEventListener('mousemove',onMove);
    svg.addEventListener('mouseleave',onLeave);
    svg.addEventListener('touchmove',e=>{e.preventDefault();onMove(e);},{passive:false});
    svg.addEventListener('touchend',onLeave);
  }

  /* ── 공통: 준비물 진행률 (PRE 전용) ── */
  function renderPrepProgress(){
    const pPct=document.getElementById('prep-pct'), pSub=document.getElementById('prep-sub');
    if(!pPct) return;
    let saved={};
    try{ saved=JSON.parse(localStorage.getItem('tokyo-prep-checks')||'{}'); }catch(e){}
    const keys=Object.keys(saved);
    if(keys.length){ const done=keys.filter(k=>saved[k]).length; pPct.textContent=Math.round(done/keys.length*100)+' %'; pSub.textContent=done+' / '+keys.length+' 완료'; }
    else { pPct.textContent='시작 전'; pSub.textContent='준비물 체크리스트 →'; }
  }
})();
