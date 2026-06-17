/* receipt-proxy.js — Cloudflare Worker (Workers AI)
 * 영수증 이미지를 Cloudflare Workers AI 비전 모델로 분석해
 * {total,currency,category,memo,items} JSON을 돌려줌.
 *
 * ✅ 외부 API(구글 등) 미사용 → 지역 차단 없음.
 * ✅ 외부 API 키 불필요 — 워커에 'AI' 바인딩만 추가하면 됨.
 *
 * 배포: 같은 폴더 README.md 참고 (코드 붙여넣기 + Bindings에서 Workers AI 'AI' 추가).
 */

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'; // Workers AI 비전 모델
const CATS = '항공, 숙박, 식비, 교통, 관광, 쇼핑, 기타';

const ALLOWED_ORIGINS = [
  'https://balancetree.github.io',
  'http://localhost:5050', // 로컬 미리보기
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
      if (req.method === 'GET') return json({ ok: true, hint: 'POST {data,mime} 로 영수증 이미지를 보내세요.' }, 200, cors);
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

      const prompt = `이 영수증 이미지를 보고 JSON 객체 "하나만" 출력해. 설명·코드블록·여러 개 금지.
{"total":숫자,"currency":"3글자코드(JPY/KRW/USD 등)","category":"다음중 하나(${CATS})","memo":"한국어로 가게/항목 요약","items":["항목들을 한국어로"]}
통화를 모르면 추정. 숫자에는 쉼표·통화기호를 넣지 마.`;

      const aiInput = { image: [...bytes], prompt, max_tokens: 512 };

      let out;
      try {
        out = await env.AI.run(MODEL, aiInput);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        // Llama 모델 최초 1회 라이선스 동의 요구(에러 5016) → 'agree' 보내고 재시도
        if (/agree|5016/i.test(msg)) {
          try { await env.AI.run(MODEL, { prompt: 'agree' }); } catch (_) {}
          out = await env.AI.run(MODEL, aiInput);
        } else {
          return json({ error: 'AI 호출 실패: ' + msg }, 502, cors);
        }
      }

      const txt = (out && out.response ? out.response : '').replace(/```json|```/g, '').trim();
      const jstr = firstJson(txt);
      if (!jstr) return json({ error: '영수증 인식 실패 — 수동 입력', raw: txt.slice(0, 200) }, 502, cors);
      let parsed;
      try { parsed = JSON.parse(jstr); }
      catch { return json({ error: '영수증 인식 실패 — 수동 입력', raw: txt.slice(0, 200) }, 502, cors); }

      return json(parsed, 200, cors);
    } catch (e) {
      return json({ error: '서버 오류: ' + (e && e.message ? e.message : String(e)) }, 500, cors);
    }
  },
};

// 텍스트에서 첫 번째 완결된 {...} JSON 객체만 추출 (여러 개·잡텍스트 섞여도 안전)
function firstJson(s) {
  const i = s.indexOf('{');
  if (i < 0) return null;
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '{') depth++;
    else if (s[k] === '}') { depth--; if (depth === 0) return s.slice(i, k + 1); }
  }
  return null;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  });
}
