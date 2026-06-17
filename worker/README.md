# 영수증 분석 프록시 (Cloudflare Worker + Workers AI)

영수증 자동입력을 **아무도 키 입력 없이** 쓰기 위한 작은 서버.
Cloudflare **Workers AI**(클라우드플레어 자체 AI)를 쓰므로:

- ✅ Google 등 외부 API를 안 써서 **지역 차단 없음**
- ✅ 외부 API 키(Gemini 등) **불필요** — 워커에 `AI` 바인딩만 추가
- ✅ 공개 사이트(`money.js`)에는 **워커 주소만** 들어감(비밀값 노출 0)

## 배포 (대시보드, CLI 불필요)

1. **Cloudflare 로그인** — https://dash.cloudflare.com (무료).
2. **Workers & Pages → Create → Workers → Hello World** → 이름 `tokyo-receipt` → **Deploy**.
3. **Edit code** → 기존 코드 지우고 [`receipt-proxy.js`](receipt-proxy.js) 전체 붙여넣기 → **Deploy**.
4. **Settings → Bindings → Add → Workers AI**
   - Variable name: **`AI`** (정확히 대문자 AI)
   - **Save / Deploy**
5. 워커 주소 확인 — `https://tokyo-receipt.<서브도메인>.workers.dev`
   - 이 프로젝트는 이미 `money.js`의 `RECEIPT_API`에 연결돼 있음(`tokyo-receipt.ducks7858.workers.dev`).
   - 주소가 다르면 알려주세요(한 줄 교체).

## 동작 확인

- 브라우저로 워커 주소를 열면 `{"ok":true,...}` → 정상.
- 돈관리 페이지에서 영수증 사진을 올리면 금액·통화·카테고리·메모가 자동 입력됩니다.

## 참고

- 예전에 넣었던 `GEMINI_KEY` 시크릿은 **이제 안 씀** — 지워도 됩니다(둬도 무방).
- `ALLOWED_ORIGINS`(기본 `balancetree.github.io`)에서 온 요청만 처리. 도메인 바뀌면 코드 목록 수정.
- 모델: `@cf/meta/llama-3.2-11b-vision-instruct`. 인식이 약하면 코드의 `MODEL`만 교체.
- Workers AI 무료 일일 한도(Neurons) 내에서 사용 — 영수증 정산엔 충분.
