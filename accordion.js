(function(){
  const items = Array.from(document.querySelectorAll('.acc-item'));

  function setOpen(item, open){
    item.classList.toggle('open', open);
    const head = item.querySelector('.acc-head');
    if(head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  items.forEach(item=>{
    const head = item.querySelector('.acc-head');
    if(!head) return;
    head.addEventListener('click', ()=> setOpen(item, !item.classList.contains('open')));
  });

  const expandAll = document.getElementById('expandAll');
  const collapseAll = document.getElementById('collapseAll');
  if(expandAll) expandAll.addEventListener('click', ()=> items.forEach(i=>setOpen(i,true)));
  if(collapseAll) collapseAll.addEventListener('click', ()=> items.forEach(i=>setOpen(i,false)));

  // 첫 항목(도착일)만 기본 펼침
  if(items.length) setOpen(items[0], true);
})();
