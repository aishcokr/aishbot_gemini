# Daily Insights — 일일 인사이트 웹앱

> **Vercel 무료 배포 | Gemini AI 챗봇 (키는 서버 보관) | 모바일 반응형**
>
> 오늘의 영어 명언 · 날씨·코디 · 경제 뉴스 · 시장 지수 · 서울·경기 지원사업 · AI 챗봇을 한 페이지에서!

---

## 목차

1. [프로젝트 소개](#1-프로젝트-소개)
2. [기능 설명](#2-기능-설명)
3. [폴더 구조](#3-폴더-구조)
4. [로컬에서 실행하기](#4-로컬에서-실행하기)
5. [GitHub 저장소 만들기 & 업로드](#5-github-저장소-만들기--업로드)
6. [Vercel 배포 & Gemini 키 설정](#6-vercel-배포--gemini-키-설정)
7. [GitHub Actions로 데이터 자동 갱신](#7-github-actions로-데이터-자동-갱신)
8. [챗봇 업데이트 방법](#8-챗봇-업데이트-방법)
9. [다른 사이트에 위젯으로 붙이기](#9-다른-사이트에-위젯으로-붙이기)
10. [자주 발생하는 문제 해결](#10-자주-발생하는-문제-해결)
11. [파일별 역할 요약](#11-파일별-역할-요약)

---

## 1. 프로젝트 소개

### 이 프로젝트가 특별한 이유

| 항목 | 내용 |
|------|------|
| **비용** | 무료 (Vercel Hobby + Gemini 무료 등급) |
| **API 키** | Gemini 키 1개 — **Vercel 환경변수에만 저장**, 브라우저에 노출 안 됨 |
| **백엔드** | 서버리스 함수 1개(`api/chat.js`) + GitHub Actions 데이터 수집 |
| **기술 스택** | HTML + CSS + Vanilla JS (빌드 도구 없음) |
| **모바일** | 완전 반응형 (모바일·태블릿·데스크톱) |
| **배포 방식** | Vercel (GitHub 연동 · push하면 자동 배포) |

### 아키텍처 원리

```
[데이터 수집 — 서버 측]
GitHub Actions
  ├─ daily-collect.yml     (매일 06:00 KST)
  │     └─ collector.py
  │           ├─ Open-Meteo     → data/weather.json
  │           ├─ 네이버 뉴스    → data/news.json
  │           ├─ yfinance       → data/finance.json
  │           └─ 기업마당       → data/bizinfo.json
  │
  └─ supports-collect.yml  (6시간마다)
        └─ 지원사업만 갱신     → data/bizinfo.json
                                       │
                              JSON 커밋 & 푸시
                                       │
                            Vercel이 push 감지 → 자동 재배포


[챗봇 — 요청이 올 때만]
브라우저                     Vercel 서버리스           Google
  chatbot.js  ──POST /api/chat──>  api/chat.js  ──키 첨부──>  Gemini
   (키 없음)                    process.env.GEMINI_API_KEY
                                  ↑ 키는 여기서만 존재
```

**핵심 포인트 2가지**

1. 화면 렌더링용 데이터는 브라우저가 `data/*.json`만 읽습니다. 스크래핑·수집은 전부 Actions(서버 측)에서 합니다.
2. **Gemini API 키는 `api/chat.js`가 실행되는 Vercel 서버에만 존재합니다.** 브라우저로 내려가는 파일에는 키가 전혀 포함되지 않으므로, 방문자가 F12로 열어봐도 확인할 수 없습니다.

> ⚠️ 참고: GitHub Pages 같은 순수 정적 호스팅에서는 이 구조가 불가능합니다.
> 브라우저가 Gemini를 직접 호출하려면 키를 브라우저가 알아야 하고, 그 순간 노출되기 때문입니다.
> **서버리스 함수를 제공하는 Vercel로 배포하는 것이 이 프로젝트의 전제 조건입니다.**

---

## 2. 기능 설명

### ① 영어 명언 (Hero 섹션)

- `script.js` 안에 명언 목록이 들어 있습니다.
- 페이지 로드 시 · `↻ 다른 명언 보기` 클릭 시 랜덤으로 바뀝니다.
- 영어 원문 → 한글 해석 → 작자 순으로 표시됩니다.

### ② 오늘의 날씨 + 코디 추천

- **날씨 소스:** Open-Meteo 공개 API (키 불필요) — 서울 기준
- **공기질:** Open-Meteo Air Quality (PM10)
- **갱신 주기:** 매일 06:00 KST (`daily-collect.yml`)
- 최고/최저 기온·강수·날씨 코드를 반영해 코디 문구·이미지를 생성합니다.

### ③ 오늘의 주요 뉴스

- **소스:** 네이버 뉴스 경제 섹션 스크래핑
- 제목 클릭 시 새 창으로 원문 이동
- **갱신 주기:** 매일 06:00 KST

### ④ 경제 / 시장 체크

- **소스:** yfinance
- **지수:** KOSPI, S&P 500, 반도체(SOX), 금(Gold)
- 전일 대비 등락·등락률 표시
- **갱신 주기:** 매일 06:00 KST

### ⑤ 서울·경기 지원사업

- **소스:** 기업마당(bizinfo.go.kr) 스크래핑
- 공고 제목 · 기간 · 상세 링크
- **갱신 주기:** 6시간마다 (`supports-collect.yml`) + 매일 전체 수집에도 포함

### ⑥ AI 사이드 챗봇 (FAQ + Gemini)

- **우하단 플로팅 버튼** 클릭 → 사이드 패널 슬라이드 인
- **2단계 답변 방식**

  | 단계 | 조건 | 동작 | 비용 |
  |------|------|------|------|
  | ① FAQ 검색 | `q`·`tags` 매칭 점수 ≥ 4 | `data/faq.json`의 답변을 즉시 표시 | 0원 (API 호출 없음) |
  | ② AI 폴백 | 매칭이 없거나 약함 | `/api/chat` → **Gemini**가 답변 생성 | Gemini 무료 등급 |

- ②단계에서는 약하게 매칭된 FAQ 항목 최대 3개를 **근거 자료로 함께 전달**해, 이 사이트의 맥락에 맞는 답변이 나오도록 합니다.
- AI가 생성한 답변에는 `✨ AI 생성 답변` 배지가 붙어 FAQ 답변과 구분됩니다.
- 직전 대화 3턴을 기억해 이어지는 질문에도 대응합니다.
- **남용 방지:** 세션당 AI 호출 30회 제한, 응답 대기 40초 제한 (`chatbot.js` 상단에서 조정 가능)
- **FAQ 내용:** ChatGPT · Claude Code 사용 가이드 (`docs/` PDF 기반, 약 50개+ Q&A)
- 데이터 파일: `data/faq.json` · 프론트 로직: `chatbot.js` · 서버 로직: `api/chat.js`

---

## 3. 폴더 구조

```
aishbot/   (또는 저장소 이름)
├── index.html                 ← 페이지 구조 + AI 챗봇 UI
├── style.css                  ← 디자인 (포레스트 그린 톤, 반응형)
├── script.js                  ← 명언 · 날씨 · 뉴스 · 금융 · 지원사업 렌더링
├── chatbot.js                 ← 메인 사이트 챗봇 (FAQ 검색 + AI 폴백 호출)
├── widget.js                  ← 외부 사이트 임베드용 위젯 (Shadow DOM)
├── dev-server.js              ← 로컬 개발 서버 (의존성 0 · npm run dev)
├── package.json               ← npm 스크립트 (dev/start). 의존성 없음
├── requirements.txt           ← Python 라이브러리 목록
├── vercel.json                ← Vercel 배포 설정 (빌드 없음 · 캐시/CORS 헤더)
├── .vercelignore              ← 배포물에서 제외할 파일
├── .env.example               ← 환경변수 템플릿 (실제 키는 .env / Vercel에)
├── .gitignore                 ← .env · 캐시 등 커밋 차단
├── README.md
├── WIDGET.md                  ← 위젯 설치 가이드 (외부 사이트용)
│
├── api/                       ← Vercel 서버리스 함수 (서버에서 실행)
│   └── chat.js                ← Gemini 프록시. API 키는 여기서만 사용
│
├── docs/                      ← 원본 가이드 PDF
│   ├── ChatGPT_사용가이드.pdf
│   └── 클로드코드_사용가이드.pdf
│
├── data/                      ← Actions가 갱신하거나 정적 FAQ
│   ├── weather.json           ← 날씨 + 코디
│   ├── news.json              ← 네이버 뉴스
│   ├── finance.json           ← 시장 지수
│   ├── bizinfo.json           ← 서울·경기 지원사업
│   ├── faq.json               ← 챗봇 Q&A
│   └── contents.json          ← (참고용/이전 샘플, 메인 화면은 위 JSON 사용)
│
├── scripts/
│   └── collector.py           ← 데이터 수집 스크립트 (한 파일)
│
└── .github/workflows/
    ├── daily-collect.yml      ← 매일 KST 06:00 전체 수집
    ├── supports-collect.yml   ← 6시간마다 지원사업만 수집
    └── clean-history.yml      ← 오래된 Actions 실행 기록 정리
```

---

## 4. 로컬에서 실행하기

### 방법 1: `npm run dev` — **AI 챗봇까지 테스트하려면 이 방법** ⭐

`api/chat.js`는 서버리스 함수라서 일반 정적 서버로는 실행되지 않습니다.
`dev-server.js`가 정적 파일 서빙과 `/api/chat` 실행을 함께 처리합니다.

```bash
# 1) .env 파일 만들고 키 넣기
cp .env.example .env          # Windows: copy .env.example .env
#    .env 를 열어 GEMINI_API_KEY=... 채우기

# 2) 개발 서버 실행 (Node.js 18+ 필요)
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 챗봇에 FAQ에 없는 질문을 던져 AI 답변을 확인합니다.

```
  Daily Insights — 로컬 개발 서버
  ───────────────────────────────────────────
  주소      http://localhost:3000
  .env      로드됨
  Gemini    키 설정됨 — AI 답변 사용 가능
  ───────────────────────────────────────────
```

**설치할 것이 없습니다.** `dev-server.js`는 Node.js 내장 모듈(`http`·`fs`·`path`)만 사용하며 의존성이 0개입니다. `npm install`도 필요 없습니다.

| 사항 | 내용 |
|------|------|
| 포트 변경 | `PORT=4000 npm run dev` (Windows PowerShell: `$env:PORT=4000; npm run dev`) |
| `npm` 없이 | `node dev-server.js` — 위와 완전히 동일합니다 |
| 키 교체 후 | **Ctrl+C → 재실행.** `.env`는 시작할 때 한 번만 읽습니다 |
| 코드 수정 후 | `api/chat.js`는 매 요청마다 다시 읽으므로 재시작 불필요. 그 외 파일은 새로고침만 |

> 키 발급: [Google AI Studio](https://aistudio.google.com/apikey) — 무료 등급으로 충분합니다.

> **참고:** `npx vercel dev`로도 실행되지만 Vercel CLI 설치와 계정 로그인·프로젝트 연결이 필요합니다.
> `npm run dev`는 그런 절차 없이 바로 뜨므로 이쪽을 권합니다.

### 방법 2: 정적 서버 — 화면만 확인할 때

```bash
python -m http.server 8000
```

`http://localhost:8000` 접속. 명언·날씨·뉴스·지수·지원사업은 정상 동작하지만,
**챗봇의 AI 폴백은 `/api/chat` 404로 실패합니다.** (FAQ 검색은 동작)

> **주의:** `index.html`을 더블클릭해서 `file://`로 열면
> `fetch()`가 차단되어 JSON·FAQ를 불러오지 못합니다.
> 반드시 `http://localhost:...` 로 여세요.

### 로컬에서 수집 스크립트만 실행

```bash
pip install -r requirements.txt
python scripts/collector.py
```

---

## 5. GitHub 저장소 만들기 & 업로드

### Step 1: GitHub 저장소 생성

1. [github.com](https://github.com) 로그인
2. 우상단 `+` → **New repository**
3. Repository name 예: `aishbot`
4. **Public** 선택 (Pages 무료 배포는 Public 권장)
5. **Create repository**

### Step 2: 로컬에서 업로드

```bash
cd jkai-ai.github.io

git init
git add .
git commit -m "feat: Daily Insights 초기 구성"

# YOUR_GITHUB_USERNAME / REPO_NAME 을 본인 정보로 교체
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

> `git pull` / `git push` 기본 대상은 **추적 중인 remote**(`origin` 등)입니다.  
> Active GitHub 계정(`gh auth status`)은 **인증(누구 권한으로)** 이고, remote URL은 **어디로** 보낼지입니다.

---

## 6. Vercel 배포 & Gemini 키 설정

### Step 1: Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속 → **Create API key**
2. 생성된 키(`AIza...`)를 복사해 둡니다.
3. **이 키를 코드나 커밋에 절대 넣지 마세요.** 아래 Step 3에서 Vercel에만 등록합니다.

### Step 2: Vercel에 저장소 연결

1. [vercel.com](https://vercel.com) → GitHub 계정으로 로그인
2. **Add New… → Project** → 방금 만든 저장소 **Import**
3. 설정값 (`vercel.json`이 있어 대부분 자동 인식됩니다)

   | 항목 | 값 |
   |------|-----|
   | Framework Preset | **Other** |
   | Build Command | 비움 |
   | Output Directory | `.` (루트) |
   | Install Command | 비움 |

4. **Deploy** 클릭

### Step 3: 환경변수에 키 등록 ★ 가장 중요

1. 프로젝트 → **Settings** → **Environment Variables**
2. 추가:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `GEMINI_API_KEY` | Step 1에서 복사한 키 | Production · Preview · Development **전부 체크** |

3. **Save** 후 **Deployments → 최신 배포 → Redeploy** (환경변수는 재배포해야 반영됩니다)

### Step 4: 확인

1. 배포 주소(`https://프로젝트명.vercel.app`) 접속
2. 우하단 💬 버튼 → FAQ에 **없을 법한 질문** 입력 (예: `파이썬으로 로또 번호 뽑는 코드 알려줘`)
3. `✨ AI 생성 답변` 배지와 함께 답변이 나오면 성공
4. F12 → Network → `chat` 요청 헤더를 확인해 보세요. **키가 어디에도 없습니다.**

### GitHub Pages는 꺼두세요

같은 사이트가 두 주소로 뜨는 것을 막고, 혼동을 줄이기 위해
저장소 → **Settings → Pages → Source: None** 으로 변경합니다.
(GitHub Pages 주소로 접속하면 `/api/chat`이 없어 챗봇 AI 기능이 동작하지 않습니다.)

### 왜 Vercel인가 — 키 노출 문제

| 배포 방식 | 키가 사는 곳 | 방문자가 볼 수 있나 |
|-----------|--------------|---------------------|
| GitHub Pages + JS에 키 하드코딩 | 배포된 JS 파일 | **보임** ❌ |
| GitHub Pages + Actions Secret 주입 | 배포된 JS 파일 | **보임** ❌ |
| **Vercel + `api/chat.js`** | Vercel 서버 환경변수 | **못 봄** ✅ |

브라우저가 Gemini를 직접 호출하는 구조라면, 난독화를 해도 네트워크 탭에 키가 그대로 찍힙니다.
**서버가 대신 호출해 주는 구조**만이 근본적인 해결책입니다.

---

## 7. GitHub Actions로 데이터 자동 갱신

### 실행 시각

| 워크플로 | 주기 | cron (UTC) |
|----------|------|------------|
| `daily-collect.yml` | 매일 오전 6시 (KST) | `0 21 * * *` |
| `supports-collect.yml` | 6시간마다 | `0 */6 * * *` |
| `clean-history.yml` | 매주 일요일 09:00 (KST) + 수동 | `0 0 * * 0` |

> **Actions와 Vercel은 역할이 다릅니다.** Actions는 *데이터 수집*, Vercel은 *배포*를 맡습니다.
> Actions가 `data/*.json`을 커밋하면 Vercel이 그 push를 감지해 자동 재배포하므로 두 기능이 잘 맞물립니다.
> 챗봇을 Vercel로 옮겼다고 해서 Actions를 지우면, 날씨·뉴스·시세가 마지막 수집 시점에 멈춥니다.

### 자동 실행 흐름

```
cron / 수동 실행
     │
     ├── collector.py (또는 지원사업만)
     │      → data/*.json 갱신
     │
     ├── git commit & push
     │
     └── Vercel이 push 감지 → 자동 재배포 → 최신 JSON 반영
```

### 수동 실행 (데이터 바로 채우기)

1. 저장소 → **Actions**
2. 왼쪽 **Daily Data Collection** 또는 **Supports Data Collection (6h)**
3. **Run workflow** → **Run workflow**
4. 1~2분 후 완료 → `data/*.json` 커밋 확인

### GitHub Secret 설정

**없음.** 수집에 쓰는 Open-Meteo · 스크래핑 · yfinance는 모두 무인증입니다.
Gemini 키는 GitHub이 아니라 **Vercel 환경변수**에 등록합니다 ([6장](#6-vercel-배포--gemini-키-설정) 참고).

---

## 8. 챗봇 업데이트 방법

챗봇은 `data/faq.json`을 먼저 검색하고, 없으면 Gemini에게 넘깁니다.
**FAQ를 잘 채워둘수록 답변이 정확해지고 API 호출도 줄어듭니다.**

### FAQ 항목 추가/수정

```json
{
  "q": "질문 내용을 자연스럽게 적으세요",
  "a": "답변 내용. 여러 줄은 \\n으로 구분합니다.\n줄바꿈 예시입니다.",
  "tags": ["키워드1", "키워드2", "검색될단어"]
}
```

**태그 팁**
- 사용자가 칠 법한 단어·동의어를 넣습니다. (예: `클로드코드`, `Claude Code`, `Claude`)
- 짧고 핵심적인 단어 위주

### PDF가 바뀌었을 때

1. 새 PDF를 `docs/`에 넣습니다.
2. `data/faq.json`을 직접 수정하거나, ChatGPT/Claude에 PDF 내용을 주고 FAQ JSON을 생성해 달라고 요청합니다.

```
프롬프트 예시:
아래 내용을 바탕으로 FAQ를 만들어줘.
형식: [{ "q": "...", "a": "...", "tags": ["...", "..."] }]
질문 20개 이상, 초보자도 이해할 수 있게 답변해줘.
```

### AI 답변 동작 조정

| 대상 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| AI 호출 기준 | `chatbot.js` → `SCORE_GOOD` | `4` | 낮추면 FAQ를 더 신뢰(AI 호출↓), 높이면 AI를 더 자주 사용 |
| 세션당 호출 상한 | `chatbot.js` → `AI_MAX_CALLS` | `30` | 할당량 보호용 |
| 응답 대기 시간 | `chatbot.js` → `AI_TIMEOUT_MS` | `40000` | ms. 위젯은 `widget.js`에 별도로 있음 |
| 사용 모델 | 환경변수 `GEMINI_MODEL` | `gemini-3.5-flash-lite` | 코드 수정 없이 `.env` / Vercel 환경변수로 교체 |

### ⚠️ 모델 선택이 속도를 좌우합니다

같은 질문으로 실측한 응답 시간입니다. 챗봇은 사용자가 기다리는 UI라 **모델 선택이 사용성에 결정적**입니다.

| 모델 | 응답 시간 | 답변 길이 | 비고 |
|---|---|---|---|
| `gemini-3.5-flash-lite` | **1.4초** | 237자 | **기본값.** 추론 토큰 0 |
| `gemini-3.1-flash-lite` | 1.3초 | 223자 | 비슷함 |
| `gemini-3.5-flash` | 16.8초 | 261자 | 느림 |
| `gemini-3.6-flash` | 35.0초 | 279자 | **너무 느림.** 타임아웃 발생 |

`gemini-3.6-flash`는 `thinkingLevel: "minimal"`로 추론을 완전히 꺼도 28초가 걸립니다.
답변 품질 차이는 이 용도(FAQ 안내)에서 체감되지 않으므로 **flash-lite 계열을 권장**합니다.

> 참고: `thinkingConfig.thinkingBudget`은 Gemini 3.x에서 거부되고(400),
> `thinkingConfig.thinkingLevel`은 `minimal`·`low`·`high`만 유효합니다.
| 답변 말투·규칙 | `api/chat.js` → `SYSTEM_PROMPT` | — | 분량·존댓말·마크다운 금지 등을 지정 |

---

## 9. 다른 사이트에 위젯으로 붙이기

> 📘 **설치 절차·도메인 등록·문제 해결을 단계별로 다룬 상세 가이드: [WIDGET.md](WIDGET.md)**
> 이 장은 요약이며, 실제 설치는 위 문서를 따라가시는 것이 편합니다.

AI 도우미 버튼만 떼어내 **다른 웹사이트에 스크립트 한 줄로** 붙일 수 있습니다.
붙이는 쪽이 GitHub Pages처럼 백엔드가 없어도 됩니다 — AI 호출은 전부 이 Vercel 프로젝트가 처리합니다.

```
회사 홈페이지 (GitHub Pages)            이 Vercel 프로젝트
  <script src=".../widget.js">   ──>   widget.js 전송
       버튼·패널 자동 생성
       질문 입력  ─────────────────>   /api/chat  ──>  Gemini
                                        (키는 여기에만 존재)
```

### Step 1: 붙일 사이트에 스크립트 한 줄

```html
<script src="https://<프로젝트명>.vercel.app/widget.js" defer></script>
```

HTML 구조를 바꾸거나 CSS를 추가할 필요가 없습니다. 버튼과 패널을 위젯이 스스로 만듭니다.
**Shadow DOM** 안에서 렌더링하므로 붙이는 사이트의 CSS와 서로 간섭하지 않습니다.

### Step 2: Vercel 환경변수에 도메인 등록 ★ 필수

이 단계를 빠뜨리면 `/api/chat`이 **403**으로 차단됩니다.

Vercel → Settings → Environment Variables → `ALLOWED_ORIGINS` 추가 후 **Redeploy**

```
ALLOWED_ORIGINS=https://aish.github.io
```

- **Origin에는 경로를 넣지 않습니다.** `https://aish.github.io/aish/` → `https://aish.github.io`
- 여러 사이트는 쉼표로 구분: `https://a.github.io,https://aish.co.kr`
- 이 Vercel 도메인 자신은 등록하지 않아도 항상 허용됩니다

### 옵션 (script 태그의 `data-*` 속성)

| 속성 | 기본값 | 설명 |
|---|---|---|
| `data-api` | 스크립트 도메인 + `/api/chat` | API 주소 |
| `data-faq` | 스크립트 도메인 + `/data/faq.json` | FAQ JSON 주소 |
| `data-title` | `AI 도우미` | 버튼·패널 제목 |
| `data-subtitle` | `FAQ + Gemini AI` | 패널 부제 |
| `data-greeting` | (기본 인사말) | 첫 인사말 |

```html
<!-- 사이트마다 다른 FAQ·제목을 쓰고 싶을 때 -->
<script src="https://<프로젝트명>.vercel.app/widget.js"
        data-title="회사 도우미"
        data-faq="https://<프로젝트명>.vercel.app/data/company_faq.json"
        defer></script>
```

### 알아두실 점

- **`widget.js`는 캐시가 5분**입니다(`vercel.json`). 위젯을 수정하고 배포해도 최대 5분간 옛 버전이 보일 수 있습니다.
- **`data/faq.json`과 `widget.js`는 누구나 읽을 수 있습니다**(`Access-Control-Allow-Origin: *`). 공개 데이터이므로 문제없지만, 비공개 내용을 FAQ에 넣지 마세요.
- **Origin 검사는 브라우저 요청만 막습니다.** `curl` 같은 직접 호출은 못 막으므로, 붙이는 사이트가 많아지면 호출 제한 추가를 검토하세요.
- 메인 사이트(`index.html`)는 위젯이 아니라 [chatbot.js](chatbot.js)를 씁니다. 두 파일의 검색·AI 로직이 같으므로, 동작을 바꿀 때는 **양쪽 모두 수정**해야 합니다.

---

## 10. 자주 발생하는 문제 해결

### 날씨/뉴스/시세가 "불러오는 중"에서 멈춤

**원인:** `data/*.json` 없음 · 형식 오류 · 로컬을 `file://`로 염  
**해결:**
1. Actions에서 **Daily Data Collection** 수동 실행
2. GitHub에서 `data/weather.json` 등 확인
3. 로컬은 `python -m http.server`로 접속

### 스크래핑 실패로 Actions가 빨간색(✗)

**원인:** 네이버·기업마당 HTML 구조 변경  
**해결:**
1. `scripts/collector.py`의 셀렉터 확인
2. 브라우저 F12로 현재 구조에 맞게 수정 후 push

### 챗봇이 FAQ를 못 불러옴

**원인:** `data/faq.json` 없음 또는 JSON 문법 오류  
**해결:** 파일 존재 확인 · [jsonlint.com](https://jsonlint.com)으로 검증  
(FAQ가 없어도 AI 폴백만으로 챗봇은 계속 동작합니다)

### 챗봇이 "지금은 답변을 가져오지 못했어요"만 반복

브라우저 F12 → **Network 탭에서 `chat` 요청의 상태 코드**를 먼저 확인하세요.

| 상태 | 원인 | 해결 |
|------|------|------|
| **404** | `/api/chat`이 없음 — 정적 서버로 열었거나 GitHub Pages 주소로 접속 | `npx vercel dev` 또는 Vercel 배포 주소로 접속 |
| **500** | `GEMINI_API_KEY` 미설정 | Vercel → Settings → Environment Variables 등록 후 **Redeploy** |
| **502** | Gemini 호출 실패 — 아래 표에서 세부 원인 확인 | 서버 콘솔(로컬) 또는 Vercel → Deployments → Functions 로그 확인 |
| **403** | Origin 불일치 | 배포된 사이트 주소로 직접 접속했는지 확인 |

> 환경변수는 **저장만으로 반영되지 않습니다.** 반드시 Redeploy 하세요.

### 502가 뜰 때 — 서버 로그의 Gemini 응답 코드별 원인

| Gemini 응답 | 메시지 | 원인 | 해결 |
|---|---|---|---|
| **404** | `... is no longer available to new users` | 지정한 모델이 신규 사용자에게 중단됨 | 메시지가 안내하는 모델명으로 `GEMINI_MODEL` 환경변수 변경 |
| **403** | `Your project has been denied access` | 키가 속한 Google 프로젝트가 차단됨 | 아래 참고 |
| **429** | `Resource has been exhausted` | 무료 등급 할당량 초과 | 잠시 후 재시도 |
| (응답 없음) | 화면에 `응답이 너무 오래 걸려 중단했습니다` | **느린 모델 사용 중** | `GEMINI_MODEL`을 `gemini-3.5-flash-lite`로 변경 ([8장 속도 표](#8-챗봇-업데이트-방법)) |
| **400** | `API key not valid` | 키 오타·잘못 복사 | 키 재확인 |

**403 “Your project has been denied access” 대처법**

모델 목록 조회는 되는데 답변 생성만 막히는 경우입니다. 특정 모델이 아니라 프로젝트 전체가 막힌 것이라 모델명을 바꿔도 해결되지 않습니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에 접속해 **Google 계정으로 로그인**되어 있는지 확인
2. 기존 키를 지우고 **Create API key → 새 프로젝트 선택**으로 다시 발급
   (Cloud Console에서 만든 키보다 AI Studio에서 만든 키가 문제가 적습니다)
3. 처음 접속이라면 **Gemini API 이용약관 동의** 절차를 완료
4. VPN·프록시를 쓰고 있다면 끄고 재시도 (지원되지 않는 지역으로 인식될 수 있습니다)
5. 그래도 안 되면 다른 Google 계정으로 키를 발급해 확인 — 계정 단위 문제인지 구분됩니다

> 이 단계 동안에도 사이트는 정상 동작합니다. FAQ에 있는 질문은 그대로 답변되고,
> AI 폴백만 "답변을 가져오지 못했어요"로 표시됩니다.

### 배포는 됐는데 AI 답변이 안 나옴

`https://사용자명.github.io/...` 로 접속하고 있지 않은지 확인하세요.
GitHub Pages에는 서버리스 함수가 없어 `/api/chat`이 404가 됩니다.
**반드시 `https://프로젝트명.vercel.app` 주소를 사용하세요.**

### Vercel 배포가 실패함

**원인:** 빌드 도구가 없는데 Vercel이 빌드를 시도  
**해결:** `vercel.json`의 `buildCommand: null` · `outputDirectory: "."` 확인,
Project Settings → General에서 Framework Preset이 **Other**인지 확인

### 로컬이 원격보다 뒤처져 push가 거절됨

**원인:** Actions가 JSON을 커밋해 원격이 앞섬  
**해결:**
```bash
git pull origin main
git push origin main
```
`index.html`만 수정했다면 `git add index.html`로 그 파일만 커밋하면 됩니다.  
pull로 들어온 JSON은 Actions 커밋이지, 내 커밋에 억지로 넣을 필요는 없습니다.

---

## 11. 파일별 역할 요약

| 파일 | 역할 | 수정 빈도 |
|------|------|-----------|
| `index.html` | 페이지 구조 + 챗봇 UI | UI 변경 시 |
| `style.css` | 전체 스타일 · 챗봇 · AI 배지 · 반응형 | 디자인 변경 시 |
| `script.js` | 명언 · 각 섹션 JSON 렌더링 | 거의 없음 |
| `chatbot.js` | 메인 사이트용 챗봇 (FAQ 검색 + AI 폴백) | 동작 조정 시 |
| `widget.js` | **외부 사이트 임베드용 위젯** (Shadow DOM 자기완결형) | 동작 조정 시 |
| `api/chat.js` | **Gemini 프록시 (서버 실행 · 키 보관 · CORS 판정)** | 모델·프롬프트 변경 시 |
| `dev-server.js` | 로컬 개발 서버 (`npm run dev`) | 거의 없음 |
| `package.json` | npm 스크립트. **의존성 없음** | 거의 없음 |
| `vercel.json` | Vercel 배포 설정 | 거의 없음 |
| `.env.example` | 환경변수 템플릿 | 거의 없음 |
| `.gitignore` | 키 파일 커밋 차단 | 거의 없음 |
| `WIDGET.md` | **위젯 설치 가이드 (외부 사이트용)** | 절차 변경 시 |
| `data/weather.json` | 날씨·코디 (Actions) | 자동 |
| `data/news.json` | 뉴스 (Actions) | 자동 |
| `data/finance.json` | 시장 지수 (Actions) | 자동 |
| `data/bizinfo.json` | 지원사업 (Actions) | 자동 |
| `data/faq.json` | 챗봇 Q&A (AI 답변의 근거 자료로도 사용) | 가이드 변경 시 |
| `docs/*.pdf` | FAQ 원본 자료 | 자료 교체 시 |
| `scripts/collector.py` | 데이터 수집 | 셀렉터/소스 변경 시 |
| `daily-collect.yml` | 매일 전체 수집 | 거의 없음 |
| `supports-collect.yml` | 6시간 지원사업 수집 | 거의 없음 |
| `clean-history.yml` | Actions 실행 기록 정리 | 거의 없음 |

---

## 보안 체크리스트

배포 전에 아래를 확인하세요.

- [ ] `GEMINI_API_KEY`가 **Vercel 환경변수에만** 있고, 코드·커밋 어디에도 없다
- [ ] `.env`가 `.gitignore`에 포함되어 있다 (`git status`에 안 나타나는지 확인)
- [ ] 배포 후 F12 → Sources / Network에서 키가 검색되지 않는다
- [ ] Google AI Studio에서 **무료 등급 키**를 사용 중이다 (예상치 못한 과금 방지)
- [ ] 필요하면 Google Cloud 콘솔에서 해당 키에 **API 제한**(Generative Language API만)과 **할당량 상한**을 걸어 두었다

> `/api/chat`은 공개 엔드포인트입니다. 키는 노출되지 않지만,
> 주소를 아는 사람이 반복 호출해 할당량을 소모할 수는 있습니다.
> Origin 검사가 브라우저발 남용은 막고, 무료 등급 키를 쓰면 과금은 발생하지 않습니다.
> 트래픽이 많아지면 IP 기반 호출 제한 추가를 검토하세요.

---

## 기술 스택 & 라이선스

- **Frontend:** HTML5 · CSS3 (Custom Properties, Grid) · Vanilla JavaScript
- **Backend:** Vercel Serverless Function (Node.js) — Gemini 프록시 1개
- **AI:** Google Gemini (`gemini-2.5-flash`)
- **Data:** Python 3 · requests · beautifulsoup4 · lxml · yfinance
- **Hosting:** Vercel (GitHub 연동 자동 배포)
- **CI/CD:** GitHub Actions (데이터 수집 · 기록 정리)
- **외부 데이터:** Open-Meteo · 네이버 뉴스 · Yahoo Finance(yfinance) · 기업마당

이 프로젝트는 **교육용** 자료입니다.  
뉴스·지원사업 등은 공개 페이지 스크래핑이며, 개인·소량 학습 목적입니다.  
AI 답변은 부정확할 수 있으므로 중요한 판단에는 공식 문서를 확인하세요.  
최신 요금·기능 정보는 각 서비스 공식 문서를 확인하세요.
