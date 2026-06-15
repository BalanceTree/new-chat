/* stay.js — 현재 위치 → 숙소 길찾기 (Google Maps) */
(function(){
  const btn = document.getElementById('stay-dir');
  if(!btn) return;

  // 목적지: 정확한 도로명 주소 확정 시 이 값만 교체하면 됨
  const DEST = encodeURIComponent('Nippori Station, Taito City, Tokyo, Japan');

  function open(url){ window.open(url, '_blank', 'noopener'); }
  function plain(){ open('https://www.google.com/maps/dir/?api=1&destination='+DEST+'&travelmode=transit'); }

  btn.addEventListener('click', ()=>{
    const old = btn.textContent;
    if(!navigator.geolocation){ plain(); return; }
    btn.textContent = '📍 위치 확인 중…';
    navigator.geolocation.getCurrentPosition(
      pos=>{
        btn.textContent = old;
        const o = pos.coords.latitude + ',' + pos.coords.longitude;
        open('https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(o)+'&destination='+DEST+'&travelmode=transit');
      },
      ()=>{ btn.textContent = old; plain(); },   // 권한 거부/실패 → 현재 위치 자동
      { enableHighAccuracy:true, timeout:8000, maximumAge:60000 }
    );
  });
})();
