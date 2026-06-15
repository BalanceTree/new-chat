(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=document.getElementById('rainfall');
  if(!box) return;
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
})();
