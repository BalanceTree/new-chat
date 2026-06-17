/* common.js — 모든 페이지 공통 상단 바(카운트다운 + 공유). .wrap 맨 위에 주입 */

/* 카카오톡 인앱 브라우저면 외부(기본) 브라우저로 다시 열기 */
(function(){
  const ua = navigator.userAgent.toLowerCase();
  if(ua.indexOf('kakaotalk') > -1){
    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
  }
})();

(function(){
  const wrap = document.querySelector('.wrap');
  if(!wrap) return;

  // 출발 07:25 / 귀국 도착 20:55 (KST)
  const DEP = new Date('2026-06-18T07:25:00+09:00');
  const END = new Date('2026-06-21T20:55:00+09:00');

  // 여행 중 "지금 할 일" (시간대별)
  const PLAN = {
    18:[['00:00','03:55','🛏️','마지막 꿀잠'],['03:55','05:15','🚗','픽업 이동 중'],['05:15','05:40','🅿️','인천공항 도착'],['05:40','07:10','🎫','탑승 준비'],['07:10','07:25','🛫','곧 이륙!'],['07:25','09:50','✈️','비행 중'],['09:50','11:30','🛬','나리타 도착'],['11:30','12:30','🍜','닛포리 · 점심'],['12:30','14:30','🏮','아사쿠사'],['14:30','16:30','🏠','숙소 체크인'],['16:30','23:59','🎮','아키하바라']],
    19:[['00:00','08:00','🛏️','수면 중'],['08:00','15:00','🏖️','에노시마 · 가마쿠라'],['15:00','23:59','🛍️','시부야 쇼핑']],
    20:[['00:00','08:00','🛏️','수면 중'],['08:00','15:30','🎭','아코스타'],['15:30','23:59','🌐','팀랩 플래닛']],
    21:[['00:00','08:00','🛏️','마지막 밤'],['08:00','10:00','🧳','체크아웃 · 짐 보관'],['10:00','14:15','🛍️','긴자 쇼핑'],['14:15','16:00','🚆','나리타 이동'],['16:00','18:25','🎫','출국 수속'],['18:25','20:55','✈️','귀국 비행'],['20:55','23:59','🏠','귀국 완료']],
  };

  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML =
    '<span class="cd"></span>' +
    '<button class="share" type="button">🔗 링크 공유</button>';
  wrap.insertBefore(bar, wrap.firstChild);

  const cd = bar.querySelector('.cd');
  const kst = () => new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));
  const toMin = s => { const [a,b] = s.split(':').map(Number); return a*60+b; };

  function curPlan(){
    const k = kst();
    const d = (k.getFullYear()===2026 && k.getMonth()===5) ? k.getDate() : 0;
    const list = PLAN[d]; if(!list) return null;
    const hm = k.getHours()*60 + k.getMinutes();
    return list.find(it => hm >= toMin(it[0]) && hm < toMin(it[1])) || null;
  }

  function render(){
    const now = new Date();
    if(now < DEP){
      const k = kst();
      const today0 = new Date(k.getFullYear(), k.getMonth(), k.getDate());
      const dd = Math.round((new Date(2026,5,18) - today0)/86400000);
      const hr = Math.floor((DEP - now)/3600000);
      cd.innerHTML = '출발까지 D-<b>'+dd+'</b><small>'+hr+'시간 남음</small>';
    } else if(now <= END){
      const p = curPlan();
      cd.innerHTML = p ? (p[2]+' 지금: <b>'+p[3]+'</b>') : '✈️ <b>도쿄</b> 여행 중';
    } else {
      cd.innerHTML = '🏠 여행 종료 · 수고하셨습니다';
    }
  }
  render();
  setInterval(render, 30000);

  const btn = bar.querySelector('.share');
  btn.addEventListener('click', async ()=>{
    const url = location.href;
    const data = {title:'도쿄 6/18–21 여행', text:'도쿄 여행 정보 페이지', url};
    if(navigator.share){
      try{ await navigator.share(data); return; }catch(e){ /* 취소 시 복사로 폴백 */ }
    }
    try{
      await navigator.clipboard.writeText(url);
      const old = btn.textContent;
      btn.textContent = '✓ 링크 복사됨';
      btn.classList.add('copied');
      setTimeout(()=>{ btn.textContent = old; btn.classList.remove('copied'); }, 1800);
    }catch(e){
      prompt('아래 링크를 복사하세요', url);
    }
  });
})();
