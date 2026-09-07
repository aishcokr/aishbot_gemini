# AI 도우미 위젯 설치 가이드

> 다른 웹사이트에 **스크립트 한 줄**로 AI 챗봇 버튼을 붙이는 방법입니다.
> 붙이는 사이트에 백엔드가 없어도 됩니다 (GitHub Pages · Netlify · 워드프레스 · 카페24 모두 가능).

---

## 목차

1. [3분 요약](#1-3분-요약)
2. [어떻게 동작하나](#2-어떻게-동작하나)
3. [Step 1 — Vercel 프로젝트 주소 확인](#3-step-1--vercel-프로젝트-주소-확인)
4. [Step 2 — 붙일 사이트의 Origin 알아내기](#4-step-2--붙일-사이트의-origin-알아내기)
5. [Step 3 — Vercel에 도메인 등록](#5-step-3--vercel에-도메인-등록)
6. [Step 4 — 사이트에 스크립트 넣기](#6-step-4--사이트에-스크립트-넣기)
7. [동작 확인 체크리스트](#7-동작-확인-체크리스트)
8. [옵션 — 사이트마다 다르게 꾸미기](#8-옵션--사이트마다-다르게-꾸미기)
9. [사이트를 더 추가하기](#9-사이트를-더-추가하기)
10. [문제 해결](#10-문제-해결)
11. [보안·비용 주의사항](#11-보안비용-주의사항)
12. [위젯 제거하기](#12-위젯-제거하기)

---

## 1. 3분 요약

바쁘시면 이것만 하시면 됩니다.

| 순서 | 할 일 | 어디서 |
|------|-------|--------|
| ① | 붙일 사이트의 **Origin** 확인 (`https://jk0601.github.io`) | 주소창 |
| ② | `ALLOWED_ORIGINS` 환경변수에 등록 → **Redeploy** | Vercel 대시보드 |
| ③ | `<script>` 한 줄 추가 | 붙일 사이트의 HTML |

```html
<!-- ③ 이 한 줄이 전부입니다. </body> 바로 위에 넣으세요 -->
<script src="https://<프로젝트명>.vercel.app/widget.js" defer></script>
```

> **②를 빠뜨리면 버튼은 보이지만 AI 답변이 403으로 막힙니다.** 가장 흔한 실수입니다.

---

## 2. 어떻게 동작하나

```
   붙이는 사이트                          Vercel 프로젝트
   (GitHub Pages 등)                      (이 저장소)
   백엔드 없음                             API 키 보관

   <script src=".../widget.js">
            │
            │  ① 위젯 파일 요청
            ├──────────────────────────>  widget.js 전송
            │
            │  ② 버튼·패널을 스스로 생성
            │     (HTML·CSS 수정 불필요)
            │
            │  ③ FAQ 목록 요청
            ├──────────────────────────>  data/faq.json
            │
            │  ④ FAQ에 없는 질문
            ├──────────────────────────>  /api/chat  ──> Gemini
            │                              (키는 여기에만)
            │  ⑤ 답변 텍스트
            <──────────────────────────
```

**핵심 3가지**

- **API 키는 위젯에 없습니다.** 브라우저로 내려가는 `widget.js`를 아무리 뜯어봐도 키가 없습니다. Gemini 호출은 Vercel 서버가 대신합니다.
- **CSS 충돌이 없습니다.** 위젯은 Shadow DOM 안에서 렌더링되어, 붙이는 사이트의 스타일이 위젯에 스며들지 않고 위젯 스타일도 밖으로 새지 않습니다.
- **붙이는 쪽은 정적 사이트여도 됩니다.** 서버가 필요한 일은 전부 Vercel이 처리합니다.

---

## 3. Step 1 — Vercel 프로젝트 주소 확인

[vercel.com](https://vercel.com) → 프로젝트 선택 → 상단 **Domains** 또는 **Visit** 버튼에서 주소를 확인합니다.

```
https://aishbot.vercel.app          ← 이런 형태
https://aishbot-jk0601.vercel.app   ← 또는 이런 형태
```

이 주소가 위젯 스크립트의 출처가 됩니다. 아래에서 `<프로젝트명>.vercel.app` 자리에 이 값을 넣으세요.

브라우저에서 아래 주소를 직접 열어 **자바스크립트 코드가 보이면** 정상입니다.

```
https://<프로젝트명>.vercel.app/widget.js
```

404가 뜬다면 아직 배포되지 않은 것입니다. `widget.js`를 커밋·푸시했는지 확인하세요.

---

## 4. Step 2 — 붙일 사이트의 Origin 알아내기

여기서 실수가 가장 많이 나옵니다. **Origin은 주소 전체가 아닙니다.**

### 규칙

```
Origin = 프로토콜 + :// + 도메인 (+ 포트)
         ↑ https      ↑ example.com

경로(/aish/), 쿼리(?a=1), 해시(#top), 끝 슬래시는 모두 제외합니다.
```

### 변환 예시

| 사이트 주소 | 등록할 Origin |
|---|---|
| `https://jk0601.github.io/aish/` | `https://jk0601.github.io` |
| `https://jk0601.github.io/aish/index.html` | `https://jk0601.github.io` |
| `https://aish.co.kr/` | `https://aish.co.kr` |
| `https://www.aish.co.kr/` | `https://www.aish.co.kr` |
| `http://localhost:8000/` | `http://localhost:8000` |

### 특히 주의할 것

브라우저는 아래를 **전부 다른 사이트로 취급**합니다. 하나라도 다르면 차단됩니다.

| 이것과 | 이것은 | |
|---|---|---|
| `https://aish.co.kr` | `https://www.aish.co.kr` | **다름** (www 유무) |
| `https://aish.co.kr` | `http://aish.co.kr` | **다름** (http/https) |
| `http://localhost:3000` | `http://localhost:8000` | **다름** (포트) |

`www` 있는 주소와 없는 주소를 모두 쓰신다면 **둘 다 등록**하세요.

### 가장 확실한 방법

붙일 사이트를 브라우저로 연 뒤 **F12 → Console** 탭에 아래를 입력하고 Enter를 누르면, 등록해야 할 값이 그대로 출력됩니다.

```js
location.origin
```

---

## 5. Step 3 — Vercel에 도메인 등록

1. [vercel.com](https://vercel.com) → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 아래 값을 추가합니다

   | 항목 | 값 |
   |------|-----|
   | **Key** | `ALLOWED_ORIGINS` |
   | **Value** | `https://jk0601.github.io` |
   | **Environments** | Production · Preview · Development **전부 체크** |

4. **Save**
5. **Deployments** 탭 → 맨 위 배포의 `⋯` 메뉴 → **Redeploy**

> ⚠️ **환경변수는 저장만으로 반영되지 않습니다.** 반드시 Redeploy 해야 새 값이 적용됩니다.
> 이걸 놓쳐서 "분명 등록했는데 계속 403"이 되는 경우가 많습니다.

### 여러 사이트를 등록할 때

쉼표로 구분해서 한 줄에 씁니다. **공백은 있어도 되고 없어도 됩니다.**

```
ALLOWED_ORIGINS=https://jk0601.github.io,https://aish.co.kr,https://www.aish.co.kr
```

### 등록하지 않아도 되는 것

- **Vercel 프로젝트 자신의 주소** (`https://<프로젝트명>.vercel.app`) — 항상 허용됩니다
- **로컬 개발 서버** (`http://localhost:3000`) — `node dev-server.js`로 띄운 자기 자신이므로 허용됩니다

---

## 6. Step 4 — 사이트에 스크립트 넣기

넣을 위치는 **`</body>` 바로 위**입니다. 페이지가 먼저 그려진 뒤 위젯이 붙습니다.

```html
  <!-- ... 페이지 내용 ... -->

  <script src="https://<프로젝트명>.vercel.app/widget.js" defer></script>
</body>
</html>
```

### 사이트 종류별 위치

**일반 HTML 사이트 / GitHub Pages (순수 HTML)**

`index.html`을 열어 `</body>` 바로 위에 붙입니다. 페이지가 여러 개면 각 HTML 파일마다 넣어야 합니다.

**GitHub Pages + Jekyll 테마**

공통 레이아웃 파일에 한 번만 넣으면 모든 페이지에 적용됩니다.

```
_layouts/default.html   ← 이 파일의 </body> 위
_includes/footer.html   ← 또는 여기
```

테마를 그대로 쓰고 계셔서 해당 파일이 없다면, 테마 저장소에서 `_layouts/default.html`을 복사해 내 저장소의 같은 경로에 만들면 덮어쓰기가 됩니다.

**워드프레스**

- 테마 편집기 → `footer.php`의 `</body>` 위
- 또는 *Insert Headers and Footers* 같은 플러그인의 "Footer" 칸에 붙여넣기 (테마 업데이트에도 안 지워져서 이 방법을 권합니다)

**카페24 · 아임웹 · 윅스 등 빌더**

관리자 페이지에서 **"외부 스크립트"**, **"HTML 삽입"**, **"코드 위젯"** 같은 항목을 찾아 붙여넣습니다. 서비스에 따라 유료 플랜에서만 지원되기도 합니다.

**노션**

스크립트 삽입이 차단되어 있어 **불가능**합니다.

---

## 7. 동작 확인 체크리스트

배포 후 붙인 사이트를 열고 순서대로 확인하세요.

| # | 확인 | 정상이라면 |
|---|------|-----------|
| 1 | 우하단에 초록 그라데이션 **AI 도우미** 버튼 | 보임 |
| 2 | 버튼 클릭 | 오른쪽에서 패널이 슬라이드 인 |
| 3 | FAQ에 **있는** 질문 (예: `ChatGPT가 무엇인가요?`) | 즉시 답변 |
| 4 | FAQ에 **없는** 질문 (예: `파이썬으로 로또 번호 뽑는 법`) | `✨ AI 생성 답변` 배지와 함께 답변 |
| 5 | F12 → **Console** | 빨간 에러 없음 |
| 6 | F12 → **Network** → `chat` 요청 | 상태 **200**, 요청 헤더에 API 키 없음 |

3번은 되는데 4번이 안 되면 → **Step 3(도메인 등록 + Redeploy)** 을 다시 확인하세요.

---

## 8. 옵션 — 사이트마다 다르게 꾸미기

`<script>` 태그에 `data-*` 속성을 붙이면 사이트별로 다르게 동작합니다. **전부 생략 가능**합니다.

| 속성 | 기본값 | 설명 |
|---|---|---|
| `data-title` | `AI 도우미` | 버튼과 패널에 표시되는 제목 |
| `data-subtitle` | `FAQ + Gemini AI` | 패널 헤더의 작은 글씨 |
| `data-greeting` | 기본 인사말 | 패널을 열었을 때 첫 메시지 |
| `data-faq` | `<프로젝트>/data/faq.json` | 사용할 FAQ 파일 주소 |
| `data-api` | `<프로젝트>/api/chat` | API 주소 (보통 바꿀 일 없음) |

### 예시 — 회사 소개 사이트용

```html
<script src="https://aishbot.vercel.app/widget.js"
        data-title="회사 안내 도우미"
        data-subtitle="무엇이든 물어보세요"
        data-greeting="안녕하세요! 회사 서비스에 대해 안내해 드립니다."
        data-faq="https://aishbot.vercel.app/data/company_faq.json"
        defer></script>
```

FAQ 파일을 새로 만드시려면 Vercel 저장소의 `data/` 폴더에 JSON을 추가하고 푸시하면 됩니다.

```json
[
  {
    "q": "영업 시간이 어떻게 되나요?",
    "a": "평일 09:00 ~ 18:00입니다.\n주말·공휴일은 휴무입니다.",
    "tags": ["영업시간", "운영시간", "휴무"]
  }
]
```

---

## 9. 사이트를 더 추가하기

두 번째, 세 번째 사이트를 붙일 때는 **두 단계만** 반복하면 됩니다.

1. Vercel → Settings → Environment Variables → `ALLOWED_ORIGINS` **Edit** → 쉼표로 새 Origin 추가 → Save → **Redeploy**
2. 새 사이트 HTML에 `<script>` 한 줄 추가

```
# 사이트 3개를 쓰는 경우
ALLOWED_ORIGINS=https://jk0601.github.io,https://aish.co.kr,https://blog.aish.co.kr
```

`widget.js`나 `api/chat.js` 코드는 **손댈 필요가 없습니다.**

### Vercel에 커스텀 도메인을 연결한 경우

Vercel 프로젝트 자체에 `https://bot.aish.co.kr` 같은 도메인을 붙이셨다면, 스크립트 주소도 그 도메인으로 바꿔 쓸 수 있습니다. 둘 다 동작하므로 필수는 아닙니다.

```html
<script src="https://bot.aish.co.kr/widget.js" defer></script>
```

---

## 10. 문제 해결

### 버튼이 아예 안 보임

| 원인 | 확인 방법 | 해결 |
|---|---|---|
| 스크립트 주소 오타 | F12 → Network에서 `widget.js`가 **404** | 주소 확인. 브라우저로 직접 열어보기 |
| `</body>` 밖에 넣음 | HTML 소스 확인 | `</body>` 바로 위로 이동 |
| 아직 배포 안 됨 | Vercel Deployments 탭 | 배포 완료 대기 |
| 다른 요소에 가려짐 | F12 → Elements | 위젯 z-index는 21억대라 거의 없는 경우 |

### 버튼은 보이는데 AI 답변만 실패

F12 → **Network** 탭에서 `chat` 요청의 상태 코드를 먼저 보세요.

| 상태 | Console 메시지 | 원인 | 해결 |
|---|---|---|---|
| **403** | `허용되지 않은 도메인입니다` | Origin 미등록 | `ALLOWED_ORIGINS` 등록 후 **Redeploy** |
| **(CORS)** | `blocked by CORS policy: No 'Access-Control-Allow-Origin' header` | 위와 동일 | 위와 동일 |
| **404** | — | `data-api` 주소 오타 | 속성 제거하고 기본값 사용 |
| **500** | `서버에 API 키가 설정되지 않았습니다` | `GEMINI_API_KEY` 미설정 | 환경변수 등록 후 Redeploy |
| **502** | `AI 서비스 오류 (403)` | Gemini 키/프로젝트 문제 | Vercel → Deployments → Functions 로그 확인 |
| **502** | `AI 서비스 오류 (404)` | 모델명 만료 | `GEMINI_MODEL` 환경변수로 최신 모델 지정 |
| (응답 없음) | `응답이 너무 오래 걸려 중단했습니다` | 느린 모델 사용 중 | `GEMINI_MODEL`을 `gemini-3.5-flash-lite`로 변경 |

### 403이 계속 나올 때 하나씩 확인

```
□ Origin에 경로가 붙어 있지 않은가?   https://a.github.io/aish/  ← ✗
□ 끝에 슬래시가 붙어 있지 않은가?      https://a.github.io/       ← ✗
□ www 유무가 실제 접속 주소와 같은가?
□ http / https 를 혼동하지 않았는가?
□ 저장 후 Redeploy 를 했는가?          ← 가장 흔한 원인
□ Production 환경에 체크했는가?
```

F12 Console에 `location.origin`을 입력해 나온 값과 `ALLOWED_ORIGINS`의 값이 **글자 하나까지 같아야** 합니다.

### 위젯을 수정했는데 반영이 안 됨

`widget.js`는 **5분간 캐시**됩니다. 급하면 주소 뒤에 버전을 붙이세요.

```html
<script src="https://aishbot.vercel.app/widget.js?v=2" defer></script>
```

브라우저 캐시가 의심되면 **Ctrl + Shift + R** (강력 새로고침)을 눌러 보세요.

### 사이트 디자인이 깨짐

Shadow DOM으로 격리되어 있어 발생하기 어렵습니다. 만약 생긴다면 위젯이 아니라 스크립트를 넣은 위치 문제(예: `<head>` 안에 넣어 파싱이 막힘)일 가능성이 큽니다. `</body>` 바로 위로 옮겨 보세요.

### FAQ 답변은 되는데 AI만 안 됨

FAQ는 정적 파일이라 CORS가 `*`로 열려 있고, AI는 도메인 검사를 거칩니다. 즉 **도메인 등록 문제**가 거의 확실합니다.

---

## 11. 보안·비용 주의사항

**API 키는 안전합니다.** 브라우저로 내려가는 `widget.js`에는 키가 없고, Gemini 호출은 Vercel 서버가 대신합니다. F12 Network에서 요청 헤더를 봐도 키가 보이지 않습니다.

**다만 `/api/chat`은 공개 엔드포인트입니다.**

- Origin 검사는 **브라우저 요청만** 막습니다. `curl` 같은 직접 호출은 Origin 헤더를 위조할 수 있어 막지 못합니다
- 위젯 자체에 **세션당 30회** 호출 제한이 있지만, 이건 브라우저 쪽 제한이라 우회 가능합니다
- 붙이는 사이트가 늘거나 트래픽이 많아지면 **서버 측 호출 제한(IP·시간당)** 추가를 검토하세요

**비용**

- FAQ에서 답을 찾으면 **API를 호출하지 않습니다.** 대부분의 질문이 여기서 처리되므로 실제 호출은 많지 않습니다
- Gemini 무료 등급을 쓰는 한 과금은 발생하지 않습니다
- FAQ(`data/faq.json`)를 잘 채워둘수록 답변이 정확해지고 호출도 줄어듭니다

**공개되는 파일**

`widget.js`와 `data/*.json`은 누구나 읽을 수 있습니다(`Access-Control-Allow-Origin: *`). 공개해도 되는 내용만 FAQ에 넣으세요.

---

## 12. 위젯 제거하기

**특정 사이트에서만 빼기** — 그 사이트의 `<script>` 한 줄을 지우면 끝입니다.

**해당 도메인의 접근을 차단하기** — Vercel 환경변수 `ALLOWED_ORIGINS`에서 그 Origin을 지우고 Redeploy 합니다. 스크립트가 남아 있어도 AI 답변이 403으로 막힙니다.

**완전히 되돌리기** — 저장소에서 `widget.js`를 삭제하고 푸시하면 `/widget.js`가 404가 되어 모든 사이트에서 버튼이 사라집니다.

---

## 참고

- 메인 사이트(`index.html`)는 위젯이 아니라 `chatbot.js`를 사용합니다. 두 파일의 검색·AI 로직이 같으므로 동작을 바꿀 때는 **양쪽 모두** 수정해야 합니다.
- 서버 쪽 설정(모델·프롬프트·토큰 한도)은 `api/chat.js`에 있습니다.
- 전체 프로젝트 구조와 배포 방법은 [README.md](README.md)를 참고하세요.
