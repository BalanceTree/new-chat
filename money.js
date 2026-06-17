/* money.js — 돈관리(정산) 모듈
 * 데이터 공유: Supabase REST (설정 시) · 미설정 시 이 기기 localStorage 폴백
 * 환율: open.er-api.com (무료·키 불필요) · 영수증 AI: 선택(무료 Google Gemini 키, 브라우저 저장)
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
  const AI_KEY_LS = 'money_gemini_key';
  const GEMINI_MODEL = 'gemini-2.0-flash'; // 무료 티어 비전 모델 (바꾸려면 여기만 수정)

  let EXP = [];

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
      payer: +row.payer, split: row.split, memo: row.memo || '', date: row.spent_on || row.date };
  }
  async function addExpense(e) {
    if (!SHARED) {
      e.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
      EXP.push(e); localStorage.setItem(LS_KEY, JSON.stringify(EXP)); return e;
    }
    const body = { trip: TRIP, amount: e.amount, currency: e.currency, category: e.category,
      payer: e.payer, split: e.split, memo: e.memo, spent_on: e.date };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/money_expenses`, {
      method: 'POST', headers: sbHeaders({ prefer: 'return=representation' }), body: JSON.stringify(body) });
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
    if (!$('#m-date').value) $('#m-date').value = new Date().toISOString().slice(0, 10);
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
      return `<div class="m-exp"><div class="ico">${CAT_ICON[e.category] || '💳'}</div>
        <div class="grow"><div class="ttl">${esc(e.memo) || e.category}</div>
          <div class="meta">${e.date} · ${payer ? payer.emo + ' ' + esc(payer.name) : '?'} 결제 · ${e.split.length}명 분할</div></div>
        <div class="amt">${won(base)}${e.currency !== 'KRW' ? `<small>${e.currency} ${(+e.amount).toLocaleString()}</small>` : ''}</div>
        <button class="m-del" data-del="${e.id}">삭제</button></div>`;
    }).join('') : '<div class="m-empty">아직 지출이 없어요. 위에서 추가해보세요.</div>';
    document.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => del(b.dataset.del));
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
        payer: +$('#m-payer').value, split, memo: $('#m-memo').value.trim(), date: $('#m-date').value });
      reset(); renderAll(); toast('저장됐어요 ✅');
    } catch (e) { toast(e.message); } finally { $('#m-save').disabled = false; }
  }
  async function del(id) {
    try { await removeExpense(id); renderAll(); toast('삭제됨'); } catch (e) { toast(e.message); }
  }
  function reset() {
    $('#m-amount').value = ''; $('#m-memo').value = ''; $('#m-ocr').style.display = 'none'; fillSelects();
  }

  /* ===== 8) 영수증 AI (선택) — 무료 Google Gemini 키로 직접 호출 ===== */
  async function analyze(file) {
    let key = localStorage.getItem(AI_KEY_LS);
    if (!key) {
      key = prompt('영수증 자동입력을 쓰려면 무료 Google Gemini API 키를 넣으세요.\n발급: aistudio.google.com/apikey (카드 등록 불필요·무료)\n이 기기 브라우저에만 저장됩니다.');
      if (!key) return; localStorage.setItem(AI_KEY_LS, key.trim());
    }
    key = key.trim();
    const drop = $('#m-drop'); drop.classList.add('busy'); $('#m-droplabel').textContent = '분석 중…';
    try {
      const b64 = await toB64(file);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: file.type || 'image/jpeg', data: b64 } },
            { text: `이 영수증을 분석해 JSON만 출력. 형식:
{"total":숫자,"currency":"3글자코드","category":"다음중하나(${CATEGORIES.join(', ')})","memo":"한국어 가게/항목 요약","items":["항목 한국어 번역"]}
통화 모르면 추정. 숫자에 쉼표·통화기호 금지.` },
          ] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (r.status === 400 || r.status === 403) { localStorage.removeItem(AI_KEY_LS); throw new Error('API 키가 올바르지 않습니다. 다시 시도하세요.'); }
      if (r.status === 429) throw new Error('무료 한도 초과 — 잠시 후 다시 시도하세요.');
      if (!r.ok) throw new Error('분석 실패 (' + r.status + ')');
      const data = await r.json();
      let txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
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
      $('#m-ocr').innerHTML = `<span style="color:var(--bad)">${esc(e.message)} — 수동 입력해 주세요.</span>`;
      toast(e.message);
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
    drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = ''; if (e.dataTransfer.files[0]) analyze(e.dataTransfer.files[0]); };
    file.onchange = (e) => { if (e.target.files[0]) analyze(e.target.files[0]); };
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
