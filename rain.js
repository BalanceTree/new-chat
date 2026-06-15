(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=document.getElementById('rainfall');
  if(box){
    const W=box.offsetWidth||box.clientWidth||720;
    /* 히어로 전체 높이에 맞게 세로 시작점도 분산 */
    for(let i=0;i<90;i++){
      const d=document.createElement('div');
      d.className='drop';
      d.style.left=Math.random()*W+'px';
      d.style.animationDuration=(0.55+Math.random()*0.75)+'s';
      /* 시작 딜레이를 duration 내로 분산 → 화면 채워진 채로 시작 */
      d.style.animationDelay=(-Math.random()*1.8)+'s';
      d.style.opacity=(0.25+Math.random()*0.55);
      /* 굵기 살짝 랜덤 */
      d.style.width=(1+Math.random()*1.2)+'px';
      box.appendChild(d);
    }
  }

  // 비 오는 일별 카드 — 히어로처럼 은은하게 떨어지는 빗방울
  document.querySelectorAll('.day.wet').forEach(card=>{
    const layer=document.createElement('div');
    layer.className='crain';
    const w=card.clientWidth||140;
    const n=card.classList.contains('heavy')?14:8;
    for(let i=0;i<n;i++){
      const d=document.createElement('div');
      d.className='drop';
      d.style.left=Math.random()*w+'px';
      d.style.animationDuration=(0.7+Math.random()*0.6)+'s';
      d.style.animationDelay=(Math.random()*1.8)+'s';
      d.style.opacity=(0.12+Math.random()*0.25);
      layer.appendChild(d);
    }
    card.insertBefore(layer, card.firstChild);
  });
})();
