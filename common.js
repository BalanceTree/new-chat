/* common.js — 모든 페이지 공통 상단 바(카운트다운 + 공유). .wrap 맨 위에 주입 */
(function(){
  const wrap = document.querySelector('.wrap');
  if(!wrap) return;

  // 출발: 2026-06-18 07:25 (KST)
  const DEP = new Date('2026-06-18T07:25:00+09:00');

  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML =
    '<span class="cd"></span>' +
    '<button class="share" type="button">🔗 링크 공유</button>';
  wrap.insertBefore(bar, wrap.firstChild);

  const cd = bar.querySelector('.cd');
  function renderCountdown(){
    const now = new Date();
    const ms = DEP - now;
    if(ms <= 0){
      const back = new Date('2026-06-21T20:55:00+09:00');
      cd.innerHTML = (new Date() < back)
        ? '✈️ <b>도쿄</b> 여행 중 · 즐거운 시간 보내세요!'
        : '🏠 여행 종료 · 수고하셨습니다';
      return;
    }
    const day = Math.floor(ms/86400000);
    const hr = Math.floor((ms%86400000)/3600000);
    cd.innerHTML = '출발까지 D-<b>'+day+'</b><small>'+hr+'시간 남음</small>';
  }
  renderCountdown();
  setInterval(renderCountdown, 60000);

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
