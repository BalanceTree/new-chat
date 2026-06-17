/* receipt-proxy.js — Cloudflare Worker (Workers AI)
 * 영수증 이미지를 비전 모델로 읽고 {total,currency,category,memo,items} JSON 반환.
 *
 * 핵심: 모델이 "합계를 잘못 고르는" 문제를 피하려고
 *   - 모델은 영수증 텍스트(품목·금액·合計 포함)를 그대로 읽게 하고
 *   - total(합계)은 워커가 合計/총액 라벨을 정규식으로 직접 추출(최우선)
 *   - currency/memo/items 등은 모델 JSON이 있으면 사용
 *
 * ✅ 외부 API/키 불필요(Workers AI). 워커에 'AI' 바인딩만 추가.
 * 배포: 같은 폴더 README.md 참고.
 */

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const CATS = ['항공', '숙박', '식비', '교통', '관광', '쇼핑', '기타'];

const ALLOWED_ORIGINS = [
  'https://balancetree.github.io',
  'http://localhost:5050',
];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allow = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allow ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    };

    try {
      if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
      if (req.method === 'GET') return json({ ok: true, hint: 'POST {data,mime}' }, 200, cors);
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
      if (!allow) return json({ error: 'forbidden origin' }, 403, cors);
      if (!env.AI) return json({ error: "워커에 'AI' 바인딩 미설정" }, 500, cors);

      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
      const { data } = body || {};
      if (!data) return json({ error: 'no image' }, 400, cors);

      let bytes;
      try { bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)); }
      catch { return json({ error: '이미지 디코드 실패' }, 400, cors); }

      const prompt = `이 영수증을 읽어줘.
먼저 영수증의 모든 줄을 보이는 그대로 적어줘 (품목, 금액, 小計/消費税/合計 포함).
그 다음 마지막에 JSON 한 줄을 추가:
{"currency":"JPY/KRW/USD 중 추정","category":"${CATS.join('/')} 중 하나","memo":"가게명 한국어","items":["주요 품목 한국어 3~5개"]}`;

      let out;
      try { out = await runVision(env, bytes, prompt); }
      catch (e) { return json({ error: 'AI 호출 실패: ' + (e && e.message ? e.message : String(e)) }, 502, cors); }

      const txt = String((out && out.response) || '').trim();
      if (!txt) return json({ error: '영수증을 읽지 못했어요 — 수동 입력' }, 502, cors);

      const j = tryJson(txt) || {};
      const money = findTotal(txt);            // 合計 라벨 우선 → 정확
      const total = money.total != null ? money.total : numOrNull(j.total);
      if (total == null) return json({ error: '합계를 못 찾음 — 금액만 수동 입력', raw: txt.slice(0, 180) }, 502, cors);

      const currency = pickCurrency(j.currency, txt) || 'JPY';
      const category = CATS.includes(j.category) ? j.category : '기타';
      const memo = (typeof j.memo === 'string' && j.memo.trim()) ? j.memo.trim() : firstLine(txt);
      const items = Array.isArray(j.items) ? j.items.slice(0, 6) : [];

      return json({ total, currency, category, memo, items }, 200, cors);
    } catch (e) {
      return json({ error: '서버 오류: ' + (e && e.message ? e.message : String(e)) }, 500, cors);
    }
  },
};

// 비전 호출(+ Llama 라이선스 최초 1회 자동 동의)
async function runVision(env, bytes, prompt) {
  const input = { image: [...bytes], prompt, max_tokens: 900 };
  try { return await env.AI.run(MODEL, input); }
  catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (/agree|5016/i.test(msg)) {
      try { await env.AI.run(MODEL, { prompt: 'agree' }); } catch (_) {}
      return await env.AI.run(MODEL, input);
    }
    throw e;
  }
}

// 合計/총액 라벨 옆 금액을 우선 추출. 없으면 가장 큰 금액(차선).
function findTotal(txt) {
  const labels = /(?:合\s*計|総\s*計|お?会計|総額|총\s*액|합\s*계|total|金額)[^\d]{0,10}([\d][\d,]*)/gi;
  let m, best = null;
  while ((m = labels.exec(txt))) { const n = +m[1].replace(/,/g, ''); if (n > 0) best = n; }
  if (best != null) return { total: best, byLabel: true };
  const nums = (txt.match(/[\d][\d,]{1,}/g) || []).map((s) => +s.replace(/,/g, '')).filter((n) => n > 0);
  return { total: nums.length ? Math.max(...nums) : null, byLabel: false };
}

function pickCurrency(fromJson, txt) {
  const v = (fromJson || '').toUpperCase();
  if (['JPY', 'KRW', 'USD', 'EUR'].includes(v)) return v;
  if (/[₩]|원|KRW/.test(txt)) return 'KRW';
  if (/[$]|USD|달러/.test(txt)) return 'USD';
  if (/[¥]|円|JPY|엔/.test(txt)) return 'JPY';
  return null;
}

function firstLine(txt) {
  const l = txt.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  return l.slice(0, 40);
}

function numOrNull(v) { if (v == null) return null; const n = Number(String(v).replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : null; }

function tryJson(s) {
  const i = s.indexOf('{');
  if (i < 0) return null;
  let d = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (d === 0) { try { return JSON.parse(s.slice(i, k + 1)); } catch { return null; } } }
  }
  return null;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  });
}
