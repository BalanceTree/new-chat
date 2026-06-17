/* money.js — 돈관리(정산) 모듈
 * 데이터 공유: Supabase REST (설정 시) · 미설정 시 이 기기 localStorage 폴백
 * 환율: open.er-api.com (무료·키 불필요) · 영수증 AI: 선택(Cloudflare Worker 프록시, 키는 서버에 숨김)
 */
(function () {
  'use strict';

  /* ===== 1) 설정 — Supabase 프로젝트 값으로 채우면 4명 공유가 켜집니다 =====
   * Supabase 대시보드 → Project Settings → API 에서 복사.
   * anon key 는 공개되어도 안전한 클라이언트 키입니다 (RLS로 보호).
   * 아래 SQL을 SQL Editor에서 한 번 실행하세요:
   *
   *   create table money_expenses (
   *     id uuid primary key default gen_random_uuid(),
   *     trip text not null default 'tokyo',
   *     amount numeric not null,
   *     currency text not null,
   *     category text not null,
   *     payer int not null,
   *     split jsonb not null,
   *     memo text default '',
   *     spent_on date not null,
   *     created_at timestamptz default now()
   *   );
   *   alter table money_expenses enable row level security;
   *   create policy "crew all" on money_expenses for all using (true) with check (true);
   *   -- 영수증 사진 보관(선택): 아래 한 줄도 실행하면 사진이 크루 공유됨
   *   alter table money_expenses add column if not exists receipt text;
   */
  const SUPABASE_URL = 'https://srxnnccuxnfhnantmrxr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeG5uY2N1eG5maG5hbnRtcnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTc4MTUsImV4cCI6MjA5NzIzMzgxNX0.mMbbrkuC_ScOXLdsPmzMduOT1k-9KEK6C7wrZ9kcMME';
  const TRIP = 'tokyo';

  /* ===== 2) 고정 데이터 ===== */
  const MEMBERS = [
    { name: '곽성은', emo: '💅' },
    { name: '장진혁', emo: '🥰' },
    { name: '한창섭', emo: '🤳' },
    { name: '윤여찬', emo: '😎' },
  ];
  const CATEGORIES = ['항공', '숙박', '식비', '교통', '관광', '쇼핑', '기타'];
  const CAT_ICON = { 항공: '✈️', 숙박: '🏨', 식비: '🍽️', 교통: '🚆', 관광: '🎟️', 쇼핑: '🛍️', 기타: '💳' };

  // 1 외화 = ? KRW (오프라인 폴백, 이후 실시간으로 덮어씀)
  const RATES = { KRW: 1, JPY: 9.1, USD: 1380, EUR: 1480 };
  const SHARED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const LS_KEY = 'money_expenses_' + TRIP;
  // 영수증 분석 프록시 URL (Cloudflare Worker). 배포 후 본인 워커 주소로 교체.
  // 키는 워커 서버에만 있고 여기엔 노출 안 됨. 비우면 영수증 자동입력 비활성(수동 입력만).
  // 배포 방법: worker/README.md 참고.
  const RECEIPT_API = 'https://tokyo-receipt.ducks7858.workers.dev';

  let EXP = [];
  let pendingReceipt = null; // 첨부된 영수증(압축 data URL) — 저장 시 함께 보관

  /* ===== 3) DOM 헬퍼 ===== */
  const $ = (s) => document.querySelector(s);
  const won = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');
  const toKRW = (amt, cur) => amt * (RATES[cur] || 1);
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  let toastTimer;
  function toast(msg) {
    const t = $('#m-toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2300);
  }

  /* ===== 4) 데이터 계층 (Supabase REST or localStorage) ===== */
  function sbHeaders(extra) {
    return Object.assign({
      apikey: SUPABASE_ANON_KEY,
      authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    }, extra || {});
  }
  async function fetchExpenses() {
    if (!SHARED) {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/money_expenses?trip=eq.${TRIP}&order=spent_on.asc,created_at.asc`, { headers: sbHeaders() });
    if (!r.ok) throw new Error('불러오기 실패 (' + r.status + ')');
    return (await r.json()).map(normalize);
  }
  function normalize(row) {
    return { id: row.id, amount: +row.amount, currency: row.currency, category: row.category,
      payer: +row.payer, split: row.split, memo: row.memo || '', date: row.spent_on || row.date,
      receipt: row.receipt || null };
  }
  async function addExpense(e) {
    if (!SHARED) {
      e.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
      EXP.push(e);
      try { localStorage.setItem(LS_KEY, JSON.stringify(EXP)); }
      catch { e.receipt = null; localStorage.setItem(LS_KEY, JSON.stringify(EXP)); toast('저장공간 부족 — 사진 없이 저장됨'); }
      return e;
    }
    const post = (b) => fetch(`${SUPABASE_URL}/rest/v1/money_expenses`, {
      method: 'POST', headers: sbHeaders({ prefer: 'return=representation' }), body: JSON.stringify(b) });
    const body = { trip: TRIP, amount: e.amount, currency: e.currency, category: e.category,
      payer: e.payer, split: e.split, memo: e.memo, spent_on: e.date };
    if (e.receipt) body.receipt = e.receipt;
    let r = await post(body);
    if (!r.ok && e.receipt) {
      // receipt 컬럼이 아직 없을 수 있음 → 사진 빼고 재시도(지출은 정상 저장)
      delete body.receipt;
      console.warn('money: receipt 컬럼 없음 — 사진 미저장. DB에 "alter table money_expenses add column if not exists receipt text;" 실행 필요');
      r = await post(body);
    }
    if (!r.ok) throw new Error('저장 실패 (' + r.status + ')');
    const saved = normalize((await r.json())[0]); EXP.push(saved); return saved;
  }
  async function removeExpense(id) {
    if (!SHARED) { EXP = EXP.filter((x) => x.id !== id); localStorage.setItem(LS_KEY, JSON.stringify(EXP)); return; }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/money_expenses?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders() });
    if (!r.ok) throw new Error('삭제 실패 (' + r.status + ')');
    EXP = EXP.filter((x) => x.id !== id);
  }

  /* ===== 5) 환율 ===== */
  async function loadRates() {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/KRW');
      const d = await r.json();
      if (d && d.rates) {
        ['JPY', 'USD', 'EUR'].forEach((c) => { if (d.rates[c]) RATES[c] = 1 / d.rates[c]; });
        $('#m-rateline').innerHTML = `실시간 환율 · 100엔 <b>${won(toKRW(100, 'JPY'))}</b> · 1달러 <b>${won(toKRW(1, 'USD'))}</b>`;
      }
    } catch {
      $('#m-rateline').textContent = '오프라인 추정 환율 사용 중';
    }
    renderAll();
  }

  /* ===== 6) 렌더 ===== */
  function fillSelects() {
    $('#m-currency').innerHTML = Object.keys(RATES).map((c) => `<option ${c === 'JPY' ? 'selected' : ''}>${c}</option>`).join('');
    $('#m-category').innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join('');
    $('#m-payer').innerHTML = MEMBERS.map((m, i) => `<option value="${i}">${m.emo} ${esc(m.name)}</option>`).join('');
    if (!$('#m-date').value) { const d = new Date(); $('#m-date').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    renderSplit();
  }
  function renderSplit() {
    $('#m-split').innerHTML = MEMBERS.map((m, i) =>
      `<div class="m-chip on" data-i="${i}"><span class="av">${m.emo}</span>${esc(m.name)}</div>`).join('');
    document.querySelectorAll('.m-chip').forEach((el) => el.onclick = () => { el.classList.toggle('on'); updateConv(); });
    updateConv();
  }
  function getSplit() { return [...document.querySelectorAll('.m-chip.on')].map((e) => +e.dataset.i); }
  function updateConv() {
    const amt = +$('#m-amount').value || 0, cur = $('#m-currency').value;
    const base = toKRW(amt, cur), n = getSplit().length || 1;
    $('#m-conv').innerHTML = amt ? `≈ <b>${won(base)}</b> · 1인당 <b>${won(base / n)}</b> (${n}명)` : '';
  }
  function renderSummary() {
    const total = EXP.reduce((s, e) => s + toKRW(e.amount, e.currency), 0);
    $('#m-total').textContent = won(total);
    $('#m-count').textContent = EXP.length + '건';
    $('#m-avg').textContent = won(total / MEMBERS.length);
  }
  function renderList() {
    const ex = [...EXP].reverse();
    $('#m-list').innerHTML = ex.length ? ex.map((e) => {
      const base = toKRW(e.amount, e.currency), payer = MEMBERS[e.payer];
      const rcpt = e.receipt ? `<img class="m-rcpt" src="${e.receipt}" alt="영수증">` : '';
      return `<div class="m-exp"><div class="ico">${CAT_ICON[e.category] || '💳'}</div>
        <div class="grow"><div class="ttl">${esc(e.memo) || e.category}</div>
          <div class="meta">${e.date} · ${payer ? payer.emo + ' ' + esc(payer.name) : '?'} 결제 · ${e.split.length}명 분할</div></div>
        ${rcpt}
        <div class="amt">${won(base)}${e.currency !== 'KRW' ? `<small>${e.currency} ${(+e.amount).toLocaleString()}</small>` : ''}</div>
        <button class="m-del" data-del="${e.id}">삭제</button></div>`;
    }).join('') : '<div class="m-empty">아직 지출이 없어요. 위에서 추가해보세요.</div>';
    document.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del(b.dataset.del));
    document.querySelectorAll('.m-rcpt').forEach((img) => img.onclick = () => openReceipt(img.src));
  }
  function openReceipt(src) {
    const o = document.createElement('div'); o.className = 'm-rcpt-overlay';
    const im = document.createElement('img'); im.src = src; o.appendChild(im);
    o.onclick = () => o.remove();
    document.body.appendChild(o);
  }
  function renderSettle() {
    const n = MEMBERS.length, paid = Array(n).fill(0), owe = Array(n).fill(0);
    EXP.forEach((e) => {
      const base = toKRW(e.amount, e.currency); paid[e.payer] += base;
      const each = base / e.split.length; e.split.forEach((i) => owe[i] += each);
    });
    const bal = MEMBERS.map((m, i) => ({ i, m, net: paid[i] - owe[i], paid: paid[i], owe: owe[i] }));
    $('#m-balances').innerHTML = bal.map((b) =>
      `<div class="m-bal"><span class="av">${b.m.emo}</span>
        <div class="grow"><div class="nm">${esc(b.m.name)}</div>
          <div class="meta">낸 돈 ${won(b.paid)} · 부담 ${won(b.owe)}</div></div>
        <div class="net ${b.net >= 0 ? 'plus' : 'minus'}">${b.net >= 0 ? '+' : ''}${won(b.net)}</div></div>`).join('');

    const cred = bal.filter((b) => b.net > 0.5).map((b) => ({ ...b })).sort((a, b) => b.net - a.net);
    const debt = bal.filter((b) => b.net < -0.5).map((b) => ({ ...b })).sort((a, b) => a.net - b.net);
    const tr = []; let ci = 0, di = 0;
    while (ci < cred.length && di < debt.length) {
      const give = Math.min(cred[ci].net, -debt[di].net);
      tr.push({ from: debt[di].m, to: cred[ci].m, amt: give });
      cred[ci].net -= give; debt[di].net += give;
      if (cred[ci].net < 0.5) ci++; if (debt[di].net > -0.5) di++;
    }
    $('#m-transfers').innerHTML = tr.length ? tr.map((t) =>
      `<div class="m-transfer"><span class="av">${t.from.emo}</span>${esc(t.from.name)}
        <span style="opacity:.6">→</span><span class="av">${t.to.emo}</span>${esc(t.to.name)}
        <b>${won(t.amt)}</b></div>`).join('') : '<div class="m-empty">정산할 내역이 없어요.</div>';
  }
  function renderAll() { renderSummary(); renderList(); renderSettle(); }

  /* ===== 7) 액션 ===== */
  async function save() {
    const amt = +$('#m-amount').value;
    if (!amt || amt <= 0) return toast('금액을 입력하세요');
    const split = getSplit();
    if (!split.length) return toast('나눠낼 사람을 선택하세요');
    $('#m-save').disabled = true;
    try {
      await addExpense({ amount: amt, currency: $('#m-currency').value, category: $('#m-category').value,
        payer: +$('#m-payer').value, split, memo: $('#m-memo').value.trim(), date: $('#m-date').value,
        receipt: pendingReceipt });
      reset(); renderAll(); toast('저장됐어요 ✅');
    } catch (e) { toast(e.message); } finally { $('#m-save').disabled = false; }
  }
  async function del(id) {
    try { await removeExpense(id); renderAll(); toast('삭제됨'); } catch (e) { toast(e.message); }
  }
  function reset() {
    $('#m-amount').value = ''; $('#m-memo').value = ''; $('#m-ocr').style.display = 'none';
    pendingReceipt = null; const p = $('#m-preview'); if (p) { p.style.display = 'none'; p.innerHTML = ''; }
    fillSelects();
  }

  /* ===== 8) 영수증 — 사진 첨부 보관 + (선택) AI 자동입력 ===== */
  // 사진 선택 시: 압축 → 미리보기/보관(pendingReceipt) → AI 분석으로 폼 자동입력
  async function handleFile(file) {
    if (!file || !(file.type || '').startsWith('image/')) return toast('이미지 파일을 선택하세요');
    let dataUrl = null;
    try { dataUrl = await compressImage(file); } catch { dataUrl = null; }
    pendingReceipt = dataUrl;
    showPreview(dataUrl);
    analyze(file, dataUrl);
  }

  function showPreview(dataUrl) {
    const p = $('#m-preview'); if (!p) return;
    if (!dataUrl) { p.style.display = 'none'; p.innerHTML = ''; return; }
    p.style.display = 'inline-block';
    p.innerHTML = '<img alt="영수증"><button type="button" class="m-prev-x" title="제거">✕</button><span class="m-prev-t">📎 영수증 첨부됨 · 저장 시 함께 보관</span>';
    p.querySelector('img').src = dataUrl;
    p.querySelector('.m-prev-x').onclick = () => { pendingReceipt = null; showPreview(null); };
  }

  // 캔버스로 리사이즈 + JPEG 압축 → data URL (DB 보관용, 가볍게)
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1100; quality = quality || 0.6;
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height; const m = Math.max(w, h);
        if (m > maxDim) { const s = maxDim / m; w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = rej; img.src = url;
    });
  }

  async function analyze(file, dataUrl) {
    if (!RECEIPT_API) return; // 자동입력 미설정 — 사진 첨부만 하고 끝
    const drop = $('#m-drop'); drop.classList.add('busy'); $('#m-droplabel').textContent = '분석 중…';
    try {
      const b64 = dataUrl ? dataUrl.split(',')[1] : await toB64(file);
      const r = await fetch(RECEIPT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: b64, mime: dataUrl ? 'image/jpeg' : (file.type || 'image/jpeg') }),
      });
      if (r.status === 429) throw new Error('무료 한도 초과 — 잠시 후 다시 시도하세요.');
      if (!r.ok) throw new Error('분석 실패 (' + r.status + ')');
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.total) $('#m-amount').value = j.total;
      if (j.currency && RATES[j.currency]) $('#m-currency').value = j.currency;
      else if (j.currency) toast(j.currency + '는 환율 미지원 — 금액만 입력됨');
      if (j.category && CATEGORIES.includes(j.category)) $('#m-category').value = j.category;
      if (j.memo) $('#m-memo').value = j.memo;
      updateConv();
      $('#m-ocr').style.display = 'block';
      $('#m-ocr').innerHTML = `<span style="color:var(--good)">✅ 분석 완료</span> <span style="color:var(--muted)">· ${esc((j.items || []).join(', ')) || '-'}</span>`;
      toast('자동 입력 완료 ✨');
    } catch (e) {
      $('#m-ocr').style.display = 'block';
      $('#m-ocr').innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span> <span style="color:var(--muted)">— 금액만 직접 입력하세요 (사진은 첨부됨)</span>`;
    } finally { drop.classList.remove('busy'); $('#m-droplabel').textContent = '영수증 사진으로 자동 입력'; }
  }
  const toB64 = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file);
  });

  /* ===== 9) 초기화 ===== */
  function bindEvents() {
    $('#m-amount').oninput = updateConv;
    $('#m-currency').onchange = updateConv;
    $('#m-save').onclick = save;
    $('#m-reset').onclick = reset;
    const drop = $('#m-drop'), file = $('#m-file');
    drop.onclick = () => file.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = 'var(--sky-mid)'; };
    drop.ondragleave = () => drop.style.borderColor = '';
    drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = ''; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
    file.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
  }
  async function init() {
    const conn = $('#m-conn');
    fillSelects(); bindEvents();
    if (SHARED) { conn.textContent = '🟢 크루 공유'; conn.classList.add('live'); }
    else { conn.textContent = '📁 이 기기 저장'; conn.classList.add('local'); }
    try { EXP = await fetchExpenses(); } catch (e) { toast(e.message); EXP = []; }
    renderAll();
    loadRates();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
