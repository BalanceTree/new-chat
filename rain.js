(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=document.getElementById('rainfall');
  if(box){
    const W=box.clientWidth||720;
    for(let i=0;i<50;i++){
      const d=document.createElement('div');
      d.className='drop';
      d.style.left=Math.random()*W+'px';
      d.style.animationDuration=(0.6+Math.random()*0.7)+'s';
      d.style.animationDelay=(Math.random()*1.6)+'s';
      d.style.opacity=(0.3+Math.random()*0.6);
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
