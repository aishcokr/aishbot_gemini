# 우리 회사 챗봇으로 만들기 — 설치 가이드

> 이 저장소를 받아 **우리 회사 전용 AI 챗봇**으로 바꾸는 방법입니다.
> **JavaScript 코드는 한 줄도 수정하지 않습니다.** 파일 2개와 환경변수 3개만 바꾸면 됩니다.

---

## 목차

1. [전체 흐름](#1-전체-흐름)
2. [준비물](#2-준비물)
3. [Step 1 — 저장소 복사](#3-step-1--저장소-복사)
4. [Step 2 — FAQ 작성 (`data/faq.json`)](#4-step-2--faq-작성-datafaqjson)
5. [Step 3 — 문구 설정 (`data/bot-config.json`)](#5-step-3--문구-설정-databot-configjson)
6. [Step 4 — Gemini API 키 발급](#6-step-4--gemini-api-키-발급)
7. [Step 5 — 로컬에서 확인](#7-step-5--로컬에서-확인)
8. [Step 6 — Vercel 배포](#8-step-6--vercel-배포)
9. [Step 7 — 우리 홈페이지에 붙이기](#9-step-7--우리-홈페이지에-붙이기)
10. [체크리스트](#10-체크리스트)
11. [자주 묻는 질문](#11-자주-묻는-질문)
12. [문제 해결](#12-문제-해결)

---

## 1. 전체 흐름

챗봇은 **2단계**로 답변합니다.

```
사용자 질문
    │
    ├─ ① data/faq.json 에서 검색  ──── 찾으면 → 그 답변을 그대로 표시 (AI 호출 없음, 무료)
    │
    └─ ② 못 찾으면 Gemini AI 호출  ─── BOT_PERSONA 를 따라 답변 생성
```

그래서 **바꿔야 할 것은 두 가지**입니다.

| 무엇을 | 어디서 | 왜 |
|---|---|---|
| **FAQ 내용** | `data/faq.json` | ①단계 답변 |
| **AI의 정체성** | `BOT_PERSONA` 환경변수 | ②단계 답변 |

`BOT_PERSONA`를 빠뜨리면 FAQ에 없는 질문이 왔을 때 AI가 엉뚱한 자기소개를 합니다. **가장 중요한 설정입니다.**

---

## 2. 준비물

| 항목 | 비고 |
|---|---|
| GitHub 계정 | 저장소 복사용 |
| Vercel 계정 | 무료 Hobby 플랜. GitHub 계정으로 로그인 가능 |
| Google 계정 | Gemini API 키 발급용 (만 18세 이상) |
| Node.js 18 이상 | 로컬 확인용. 없어도 배포는 가능합니다 |

**비용은 들지 않습니다.** Vercel Hobby(비상업적 용도)와 Gemini 무료 등급으로 운영됩니다.

---

## 3. Step 1 — 저장소 복사

원본 저장소를 **Fork** 하거나, 내려받아 새 저장소로 올립니다.

```bash
git clone https://github.com/<원본계정>/<저장소명>.git our-chatbot
cd our-chatbot

# 원본과의 연결을 끊고 우리 저장소로 연결
rm -rf .git
git init
git branch -M main
git remote add origin https://github.com/<우리계정>/<우리저장소>.git
```

### 챗봇만 쓸 경우 지워도 되는 파일

원본은 챗봇 + 대시보드(날씨·뉴스·주가)가 합쳐진 형태입니다. **챗봇만** 필요하면 아래를 삭제하세요.

```
index.html  style.css  script.js  chatbot.js   ← 대시보드 화면
scripts/                                        ← 데이터 수집 스크립트
.github/workflows/                              ← 자동 수집 (돌면 커밋만 쌓입니다)
requirements.txt
data/weather.json  data/news.json  data/finance.json  data/bizinfo.json
docs/
```

**반드시 남겨야 하는 파일**

```
api/chat.js            ← Gemini 프록시 (서버에서 실행)
widget.js              ← 홈페이지에 붙는 위젯
data/faq.json          ← 우리 FAQ
data/bot-config.json   ← 화면 문구
vercel.json            ← 배포 설정
package.json           ← npm 스크립트
dev-server.js          ← 로컬 확인용
.gitignore  .vercelignore  .env.example
```

---

## 4. Step 2 — FAQ 작성 (`data/faq.json`)

가장 중요한 작업입니다. **FAQ가 충실할수록 답변이 정확해지고 AI 호출도 줄어듭니다.**

### FAQ는 여러 파일로 나눌 수 있습니다

`data/bot-config.json`의 `faqFiles`에 적힌 파일들을 **모두 합쳐서** 사용합니다.

```json
"faqFiles": [
  "data/faq.json",
  "data/faq-guide.json"
]
```

| 파일 | 내용 |
|---|---|
| `data/faq.json` | 회사 FAQ — **여기를 우리 내용으로 교체하세요** |
| `data/faq-guide.json` | ChatGPT · Claude Code 사용 가이드 (샘플로 딸려 온 것) |

**특정 주제를 빼고 싶으면 그 파일을 삭제하기만 하면 됩니다.** 없는 파일은 조용히 건너뜁니다.
`faqFiles` 목록을 고칠 필요도 없습니다.

```bash
# 예: ChatGPT 가이드가 필요 없을 때
git rm data/faq-guide.json
```

주제별로 파일을 나누면 관리도 쉬워집니다.

```json
"faqFiles": ["data/faq-인사.json", "data/faq-총무.json", "data/faq-IT.json"]
```

> 같은 질문이 여러 파일에 있으면 **목록에서 앞쪽 파일이 우선**합니다.

### 형식

```json
[
  {
    "q": "영업 시간이 어떻게 되나요?",
    "a": "평일 09:00 ~ 18:00입니다.\n점심시간은 12:00 ~ 13:00이며, 주말·공휴일은 휴무입니다.",
    "tags": ["영업시간", "운영시간", "몇시", "휴무", "주말"]
  },
  {
    "q": "AS 신청은 어떻게 하나요?",
    "a": "고객센터(02-000-0000) 또는 홈페이지 문의하기로 접수해 주세요.\n접수 후 영업일 기준 2일 이내에 담당자가 연락드립니다.",
    "tags": ["AS", "에이에스", "수리", "고장", "접수", "신청"]
  }
]
```

| 필드 | 설명 |
|---|---|
| `q` | 질문. 사용자가 실제로 물어볼 법한 자연스러운 문장 |
| `a` | 답변. 줄바꿈은 `\n` |
| `tags` | **검색 키워드.** 이게 매칭 정확도를 좌우합니다 |

### `tags` 작성 요령 — 가장 중요합니다

검색은 사용자가 입력한 단어를 `q`·`tags`·`a`와 대조해 점수를 매깁니다. 그래서 **사용자가 칠 법한 모든 표현**을 tags에 넣어야 합니다.

| 넣어야 할 것 | 예시 |
|---|---|
| 동의어 | `AS` / `에이에스` / `수리` / `고장` |
| 줄임말·구어체 | `영업시간` / `몇시` / `언제 열어` |
| 영문·한글 표기 | `AS` / `A/S` / `애프터서비스` |
| 오타로 자주 나는 형태 | `설치방법` / `설치 방법` |

> **주의:** 두 글자 미만 단어는 검색에서 무시됩니다. `A/S` 같은 한 글자 조합은 `에이에스`처럼 풀어서도 넣어 주세요.

### 몇 개나 만들어야 하나

**30~50개**를 권장합니다. 그 미만이면 대부분의 질문이 AI 폴백으로 넘어가 응답이 느려지고 답변이 부정확해집니다.

### PDF·문서가 있다면

기존 안내 자료가 있으면 ChatGPT나 Claude에 넣고 이렇게 요청하세요.

```
아래 내용을 바탕으로 FAQ JSON을 만들어줘.
형식: [{ "q": "...", "a": "...", "tags": ["...", "..."] }]
- 질문 40개 이상
- tags에는 사용자가 검색할 만한 동의어와 줄임말을 5개 이상 넣어줘
- 답변은 3~5문장, 존댓말
```

### 검증

작성 후 [jsonlint.com](https://jsonlint.com)에 붙여넣어 문법 오류가 없는지 확인하세요. **쉼표 하나만 틀려도 챗봇이 FAQ를 통째로 못 읽습니다.**

---

## 5. Step 3 — 문구 설정 (`data/bot-config.json`)

화면에 보이는 모든 글자를 여기서 바꿉니다.

```json
{
  "faqFiles": ["data/faq.json"],

  "title": "○○건설 고객 도우미",
  "subtitle": "24시간 문의 안내",
  "tagline": "무엇이든 물어보세요",

  "greeting": [
    "안녕하세요! ○○건설 고객 도우미입니다.",
    "시공·AS·견적 관련 문의를 도와드립니다."
  ],

  "suggestions": [
    { "label": "영업시간",   "q": "영업 시간이 어떻게 되나요?" },
    { "label": "AS 신청",    "q": "AS 신청은 어떻게 하나요?" },
    { "label": "견적 문의",  "q": "견적은 어떻게 받나요?" },
    { "label": "오시는 길",  "q": "회사 위치가 어디인가요?" }
  ],

  "disclaimer": "AI가 생성한 답변은 부정확할 수 있습니다. 정확한 내용은 고객센터로 문의해 주세요."
}
```

| 항목 | 표시 위치 |
|---|---|
| `faqFiles` | 합쳐서 읽을 FAQ 파일 목록 (없는 파일은 건너뜀) |
| `title` | 버튼 제목 · 패널 상단 |
| `subtitle` | 패널 상단 작은 글씨 |
| `tagline` | 버튼의 둘째 줄 |
| `greeting` | 패널을 열었을 때 첫 메시지 (문단 배열) |
| `suggestions` | 추천 질문 버튼 (**최대 6개**까지 표시) |
| `disclaimer` | 패널 맨 아래 안내 문구 |

**`suggestions` 팁:** `label`은 버튼에 보이는 짧은 말, `q`는 실제로 챗봇에 전달되는 질문입니다. `label`을 짧게 써야 버튼이 예쁘게 배치됩니다. `q`는 `faq.json`의 질문과 똑같이 적으면 즉시 정확한 답이 나옵니다.

---

## 6. Step 4 — Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속 (Google 계정 로그인)
2. **API 키 만들기** 클릭 → 프로젝트 선택
3. 생성된 키를 복사

> **키는 절대 코드나 GitHub에 넣지 마세요.** 뒤의 Vercel 환경변수에만 등록합니다.
> 이 저장소의 `.gitignore`가 `.env`를 막아두었지만, 실수로 다른 파일에 붙여넣지 않도록 주의하세요.

**403 `Your project has been denied access` 오류가 난다면**

- Google 계정 생년월일이 만 18세 이상으로 등록되어 있는지 확인 ([설정](https://myaccount.google.com/birthday))
- 다른 프로젝트나 다른 Google 계정으로 키를 재발급
- VPN을 쓰고 있다면 끄고 재시도

---

## 7. Step 5 — 로컬에서 확인

배포 전에 내 PC에서 먼저 확인합니다.

```bash
# 1) .env 파일 만들기
cp .env.example .env          # Windows: copy .env.example .env
```

`.env`를 열어 두 줄을 채웁니다.

```
GEMINI_API_KEY=발급받은_키
BOT_PERSONA=당신은 ○○건설의 고객 안내 도우미입니다. 시공·AS·견적 문의를 안내합니다.
```

```bash
# 2) 실행 (설치할 것 없음 — 의존성 0개)
npm run dev
```

`http://localhost:3000` 접속 후 확인합니다.

- 우하단 버튼의 제목이 `bot-config.json`의 `title`로 바뀌었는가
- 추천 질문이 우리 것으로 바뀌었는가
- FAQ에 **있는** 질문 → 즉시 답변되는가
- FAQ에 **없는** 질문 → `✨ AI 생성 답변`이 나오고, **우리 회사 도우미처럼 답하는가**

> 마지막 항목이 핵심입니다. AI가 엉뚱한 자기소개를 한다면 `BOT_PERSONA`가 적용되지 않은 것입니다.
> `.env`를 고쳤다면 **Ctrl+C 후 재실행**해야 합니다 (`.env`는 시작할 때 한 번만 읽습니다).

---

## 8. Step 6 — Vercel 배포

### 저장소 연결

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**
2. 우리 저장소 **Import**
3. 설정 (대부분 자동 인식됩니다)

   | 항목 | 값 |
   |---|---|
   | Framework Preset | **Other** |
   | Build Command | 비움 |
   | Output Directory | `.` |

4. **Deploy**

### 환경변수 등록 ★ 가장 중요

**Settings → Environment Variables** 에서 3개를 등록합니다. 모두 **Production · Preview · Development 전부 체크**하세요.

| Key | Value | 필수 |
|---|---|---|
| `GEMINI_API_KEY` | 발급받은 키 | ✅ |
| `BOT_PERSONA` | 우리 회사 도우미 설명 한 문장 | ✅ |
| `ALLOWED_ORIGINS` | 위젯을 붙일 사이트 주소 | 위젯 쓸 때만 |

선택 항목:

| Key | 기본값 | 설명 |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | 모델 변경 시 |

> ⚠️ **저장 후 반드시 Redeploy 하세요.** Deployments 탭 → 최신 배포 → `⋯` → **Redeploy**.
> 환경변수는 저장만으로 반영되지 않습니다. 가장 흔한 실수입니다.

---

## 9. Step 7 — 우리 홈페이지에 붙이기

회사 홈페이지 HTML의 `</body>` 바로 위에 한 줄을 넣습니다.

```html
<script src="https://<우리프로젝트>.vercel.app/widget.js" defer></script>
```

그리고 **홈페이지 주소를 `ALLOWED_ORIGINS`에 등록**해야 합니다. 이걸 빠뜨리면 버튼은 보이지만 AI 답변이 403으로 막힙니다.

```
ALLOWED_ORIGINS=https://ourcompany.co.kr
```

> **주소가 아니라 Origin을 넣습니다.** 경로는 빼세요.
> `https://ourcompany.co.kr/support/faq.html` → `https://ourcompany.co.kr`
>
> `www` 유무, `http`/`https`는 서로 다른 것으로 취급됩니다. 둘 다 쓰면 쉼표로 둘 다 등록하세요.

자세한 내용과 사이트 종류별(워드프레스·Jekyll·카페24 등) 설치 위치는 **[WIDGET.md](WIDGET.md)** 를 참고하세요.

---

## 10. 체크리스트

배포 전 확인하세요.

```
[ ] data/faq.json 을 우리 FAQ로 교체했다 (30개 이상 권장)
[ ] jsonlint.com 으로 JSON 문법을 검증했다
[ ] data/bot-config.json 의 title·greeting·suggestions 를 바꿨다
[ ] Vercel에 GEMINI_API_KEY 를 등록했다
[ ] Vercel에 BOT_PERSONA 를 등록했다        ← 빠뜨리기 쉬움
[ ] 위젯을 쓴다면 ALLOWED_ORIGINS 를 등록했다
[ ] 환경변수 등록 후 Redeploy 했다           ← 빠뜨리기 쉬움
[ ] .env 파일이 GitHub에 올라가지 않았다 (git status 로 확인)
[ ] FAQ에 없는 질문을 던져 AI가 우리 회사 도우미처럼 답하는지 확인했다
```

---

## 11. 자주 묻는 질문

**Q. FAQ만 바꾸면 되나요?**
아니요. `BOT_PERSONA`도 반드시 바꿔야 합니다. FAQ는 등록된 질문에만 쓰이고, 그 외 질문은 `BOT_PERSONA`를 따릅니다.

**Q. 비용이 드나요?**
Vercel Hobby(비상업적)와 Gemini 무료 등급으로 무료입니다. FAQ에서 답을 찾으면 AI를 호출하지 않으므로 실제 API 사용량은 많지 않습니다. 다만 **상업적 용도라면 Vercel 유료 플랜**이 필요합니다.

**Q. API 키가 노출되지 않나요?**
노출되지 않습니다. 키는 Vercel 서버에만 있고, 브라우저는 `/api/chat`을 호출할 뿐입니다. 배포 후 F12 → Network에서 확인해 보세요.

**Q. FAQ를 수정하면 바로 반영되나요?**
`data/faq.json`을 수정해 push하면 Vercel이 자동 재배포합니다. 1~2분 후 반영됩니다.

**Q. 답변 말투를 바꾸고 싶어요.**
`BOT_PERSONA`에 원하는 톤을 적으면 됩니다. 예: `...안내합니다. 친근하고 밝은 말투로 답하세요.`
문장 수·마크다운 금지 같은 공통 규칙은 `api/chat.js`의 `ANSWER_RULES`에 있습니다.

**Q. 여러 회사가 한 서버를 같이 쓸 수 있나요?**
권장하지 않습니다. `BOT_PERSONA`가 서버 전체에 하나뿐이라 회사별로 다르게 답할 수 없고, API 사용량도 섞입니다. **회사마다 각자 배포**하세요.

**Q. 답변이 너무 느려요.**
`GEMINI_MODEL`이 `gemini-3.5-flash-lite`인지 확인하세요. 상위 모델은 같은 질문에 20~35초가 걸립니다.

---

## 12. 문제 해결

### 챗봇 버튼은 보이는데 답변이 안 됨

F12 → **Network** 탭에서 `chat` 요청의 상태 코드를 확인합니다.

| 상태 | 원인 | 해결 |
|---|---|---|
| **403** | `ALLOWED_ORIGINS` 미등록 | 홈페이지 Origin 등록 후 **Redeploy** |
| **404** | `/api/chat` 없음 | Vercel 배포 주소로 접속했는지 확인 (GitHub Pages 주소 아님) |
| **500** | `GEMINI_API_KEY` 미설정 | 환경변수 등록 후 **Redeploy** |
| **502** | Gemini 키·모델 문제 | Vercel → Deployments → Functions 로그 확인 |

### AI가 엉뚱한 자기소개를 함

`BOT_PERSONA`가 적용되지 않았습니다.

- Vercel 환경변수에 등록했는지 확인
- 등록 후 **Redeploy** 했는지 확인
- 로컬이라면 `.env` 수정 후 서버를 **재시작**했는지 확인

### 추천 질문·제목이 안 바뀜

`data/bot-config.json` 문제입니다.

- JSON 문법 오류 확인 ([jsonlint.com](https://jsonlint.com))
- F12 → Console에 `기본 문구를 사용합니다` 경고가 있는지 확인
- 브라우저 강력 새로고침 (**Ctrl + Shift + R**)

### FAQ가 검색되지 않음

- `data/faq.json`의 JSON 문법 확인
- F12 → Console에서 `FAQ 로드 완료: N개 항목` 메시지가 나오는지 확인
- 나온다면 **`tags`에 검색어가 부족**한 것입니다. 사용자가 칠 법한 단어를 더 넣으세요

### 답변이 40초 만에 "응답이 너무 오래 걸려 중단했습니다"

느린 모델을 쓰고 있습니다. `GEMINI_MODEL`을 `gemini-3.5-flash-lite`로 설정하고 Redeploy 하세요.

---

## 관련 문서

| 문서 | 내용 |
|---|---|
| [README.md](README.md) | 전체 프로젝트 구조와 상세 설정 |
| [WIDGET.md](WIDGET.md) | 외부 사이트에 위젯 붙이기 (도메인 등록 포함) |
| `.env.example` | 환경변수 목록과 설명 |
