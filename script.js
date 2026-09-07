/* ============================================================
   script.js — 5개 섹션 렌더링
   ① 명언(랜덤)  ② 날씨+코디  ③ 뉴스  ④ 경제지수  ⑤ 지원사업
   각 섹션은 data/ 폴더의 JSON 파일을 fetch()로 읽어옵니다.
   JSON 로드 실패 시 "데이터를 준비 중입니다" 메시지 표시.
   ============================================================ */


/* ══════════════════════════════════════════════════════════
   1. 명언 데이터 (JS 배열)
   새 명언 추가: 쉼표로 구분하여 { text, translation, author } 객체 추가
   ══════════════════════════════════════════════════════════ */
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", translation: "앞서 나가는 비결은 시작하는 것입니다.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", translation: "멈추지 않는 한, 얼마나 천천히 가는지는 중요하지 않습니다.", author: "Confucius" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", translation: "성공은 끝이 아니고 실패는 치명적이지 않습니다. 중요한 것은 계속할 용기입니다.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", translation: "할 수 있다고 믿는 순간, 이미 절반은 온 것입니다.", author: "Theodore Roosevelt" },
  { text: "Your time is limited, so don't waste it living someone else's life.", translation: "당신의 시간은 한정되어 있습니다. 다른 사람의 삶을 사는 데 낭비하지 마세요.", author: "Steve Jobs" },
  { text: "The only way to do great work is to love what you do.", translation: "위대한 일을 하는 유일한 방법은 자신이 하는 일을 사랑하는 것입니다.", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", translation: "어려움 한가운데에 기회가 있습니다.", author: "Albert Einstein" },
  { text: "Life is what happens to you while you're busy making other plans.", translation: "인생은 다른 계획을 세우느라 바쁜 동안 일어나는 일입니다.", author: "John Lennon" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", translation: "미래는 자신의 꿈의 아름다움을 믿는 사람들에게 속합니다.", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", translation: "가장 어두운 순간에 빛을 보기 위해 집중해야 합니다.", author: "Aristotle" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", translation: "길이 있는 곳으로 가지 말고, 길이 없는 곳으로 가서 흔적을 남기세요.", author: "Ralph Waldo Emerson" },
  { text: "You miss 100% of the shots you don't take.", translation: "시도하지 않으면 100% 실패합니다.", author: "Wayne Gretzky" },
  { text: "Whether you think you can or you think you can't, you're right.", translation: "할 수 있다고 생각하든 할 수 없다고 생각하든, 당신이 옳습니다.", author: "Henry Ford" },
  { text: "An investment in knowledge pays the best interest.", translation: "지식에 대한 투자가 가장 높은 이자를 냅니다.", author: "Benjamin Franklin" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", translation: "나무를 심기 가장 좋은 때는 20년 전이었고, 두 번째로 좋은 때는 바로 지금입니다.", author: "Chinese Proverb" },
  { text: "Don't watch the clock; do what it does. Keep going.", translation: "시계를 보지 말고, 시계처럼 행동하세요. 계속 나아가세요.", author: "Sam Levenson" },
  { text: "The harder I work, the luckier I get.", translation: "더 열심히 일할수록 더 운이 좋아집니다.", author: "Samuel Goldwyn" },
  { text: "Strive not to be a success, but rather to be of value.", translation: "성공하려 하지 말고, 가치 있는 사람이 되려고 노력하세요.", author: "Albert Einstein" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", translation: "저는 실패한 것이 아닙니다. 작동하지 않는 1만 가지 방법을 발견했을 뿐입니다.", author: "Thomas Edison" },
  { text: "The only limit to our realization of tomorrow will be our doubts of today.", translation: "내일의 실현에 대한 유일한 한계는 오늘의 의심입니다.", author: "Franklin D. Roosevelt" },
];


/* ── 공통 유틸리티 ────────────────────────────────────────── */

/**
 * JSON 파일을 가져옵니다. 실패하면 null을 반환합니다.
 * async/await: 비동기 작업(파일 다운로드)이 끝날 때까지 기다리는 문법
 */
async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[fetch 실패] ${path}:`, e.message);
    return null;  // 실패해도 null 반환 → 페이지는 깨지지 않음
  }
}

/** 준비 중 메시지 HTML */
function pendingHTML(msg = "데이터를 준비 중입니다 🔄") {
  return `<div class="loading-msg">${msg}</div>`;
}

const WEEKDAYS_FULL  = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const WEEKDAYS_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-06-14" 또는 "2026-06-14 01:09:22" → Date 객체 */
function parseDateInput(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 2026년 06월 14일 (토요일) */
function formatDateLong(value) {
  const date = parseDateInput(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS_FULL[date.getDay()]})`;
}

/** 2026년 06월 14일 (토) */
function formatDateShort(value) {
  const date = parseDateInput(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS_SHORT[date.getDay()]})`;
}

/** 섹션 제목에 날짜를 붙입니다. */
function setSectionTitle(id, baseTitle, dateValue) {
  const el = document.getElementById(id);
  if (!el) return;
  const dateLabel = formatDateShort(dateValue);
  el.textContent = dateLabel ? `${baseTitle} — ${dateLabel}` : baseTitle;
}

/** 수집 메타 정보 박스 HTML */
function collectInfoHTML(parts) {
  const text = parts.filter(Boolean).join(" | ");
  if (!text) return "";
  return `<div class="collect-info">${text}</div>`;
}


/* ══════════════════════════════════════════════════════════
   2. 명언 렌더링
   ══════════════════════════════════════════════════════════ */
function renderQuote() {
  // Math.random(): 0 이상 1 미만 무작위 소수 → floor로 정수 인덱스 변환
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById("quote-en").textContent     = q.text;
  document.getElementById("quote-ko").textContent     = q.translation;
  document.getElementById("quote-author").textContent = "— " + q.author;
}


/* ══════════════════════════════════════════════════════════
   3. 날씨 + 코디
   ══════════════════════════════════════════════════════════ */
async function renderWeather() {
  const el   = document.getElementById("weather-body");
  const meta = document.getElementById("weather-meta");
  const data = await fetchJSON("data/weather.json");

  if (!data || data.temp === null) {
    el.innerHTML = pendingHTML();
    return;
  }

  const dateValue = data.date || data.last_updated;
  setSectionTitle("weather-title", "🌤️ 오늘의 날씨와 추천 코디", dateValue);
  if (meta) meta.textContent = "자동 수집";

  const tempRange = (data.temp_min != null && data.temp_max != null)
    ? `${data.temp_min}~${data.temp_max}°C`
    : `${data.temp}°C`;

  el.innerHTML = `
    ${collectInfoHTML([
      `수집 시각: ${data.last_updated || "-"}`,
      data.region ? `지역: ${data.region}` : "",
      `기온: ${tempRange}`,
      data.rain ? `강수: ${data.rain}` : "",
      data.dust ? `미세먼지: ${data.dust}` : "",
      "출처: Open-Meteo API",
    ])}
    <p class="section-date">${formatDateLong(dateValue)}</p>
    <div class="weather-card">
      ${data.image
        ? `<img src="${data.image}" alt="날씨 코디 이미지" class="weather-img">`
        : ""}
      <div class="weather-body">
        <p class="weather-date-label">오늘의 코디</p>
        <div class="weather-temp">
          ${data.temp}<span>°C · ${data.description}</span>
        </div>
        <p class="weather-outfit">
          <strong>오늘의 추천 코디</strong><br>${data.outfit}
        </p>
        ${data.link
          ? `<a href="${data.link}" target="_blank" rel="noopener" class="outfit-btn">
               코디 더보기 →
             </a>`
          : ""}
      </div>
    </div>
  `;
}


/* ══════════════════════════════════════════════════════════
   4. 뉴스 목록
   ══════════════════════════════════════════════════════════ */
async function renderNews() {
  const el   = document.getElementById("news-body");
  const meta = document.getElementById("news-meta");
  const data = await fetchJSON("data/news.json");

  if (!data || !data.news || data.news.length === 0) {
    el.innerHTML = pendingHTML();
    return;
  }

  const dateValue = data.date || data.last_updated;
  setSectionTitle("news-title", "📰 오늘의 주요 뉴스", dateValue);
  if (meta) meta.textContent = "자동 수집";

  el.innerHTML = `
    ${collectInfoHTML([
      `수집 시각: ${data.last_updated || "-"}`,
      `뉴스 ${data.news.length}건`,
      "출처: 네이버뉴스 경제",
    ])}
    <div class="news-list">
      ${data.news.map((item, i) => `
        <a href="${item.link}" target="_blank" rel="noopener" class="news-item">
          <span class="news-num">${i + 1}</span>
          <span class="news-title">${item.title}</span>
          <span class="news-arrow">→</span>
        </a>
      `).join("")}
    </div>
  `;
}


/* ══════════════════════════════════════════════════════════
   5. 경제/시장 지수
   ══════════════════════════════════════════════════════════ */
async function renderFinance() {
  const el   = document.getElementById("finance-body");
  const meta = document.getElementById("finance-meta");
  const data = await fetchJSON("data/finance.json");

  if (!data || !data.items || data.items.length === 0) {
    el.innerHTML = pendingHTML();
    return;
  }

  const dateValue = data.last_updated;
  setSectionTitle("finance-title", "💹 경제/시장 체크", dateValue);

  if (meta) meta.textContent = "자동 수집";

  el.innerHTML = `
    ${collectInfoHTML([
      `수집 시각: ${data.last_updated || "-"}`,
      `지수 ${data.items.length}건`,
      "출처: Yahoo Finance (yfinance)",
    ])}
    <div class="finance-grid">
      ${data.items.map(item => {
        // 등락 방향에 따라 CSS 클래스와 아이콘 결정
        const dir   = item.percent > 0 ? "up" : item.percent < 0 ? "down" : "flat";
        const arrow = item.percent > 0 ? "▲" : item.percent < 0 ? "▼" : "–";
        const sign  = item.percent > 0 ? "+" : "";

        return `
          <div class="finance-card">
            <div class="finance-name">${item.name}</div>
            <div class="finance-price">${item.price.toLocaleString()}</div>
            <div class="finance-change ${dir}">
              ${arrow} ${sign}${item.change.toLocaleString()}
              <span style="font-weight:400">(${sign}${item.percent.toFixed(2)}%)</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


/* ══════════════════════════════════════════════════════════
   6. 서울·경기 지원사업
   ══════════════════════════════════════════════════════════ */
async function renderBizinfo() {
  const el   = document.getElementById("biz-body");
  const meta = document.getElementById("biz-meta");
  const data = await fetchJSON("data/bizinfo.json");

  if (!data || !data.items || data.items.length === 0) {
    el.innerHTML = pendingHTML();
    return;
  }

  const dateValue = data.last_updated;
  setSectionTitle("biz-title", "🏢 서울·경기 지원사업 정보", dateValue);

  if (meta) meta.textContent = "자동 수집";

  el.innerHTML = `
    ${collectInfoHTML([
      `수집 시각: ${data.last_updated || "-"}`,
      `공고 ${data.items.length}건`,
      "출처: 기업마당",
    ])}
    <div class="biz-grid">
      ${data.items.map(item => `
        <div class="biz-card">
          <p class="biz-title">${item.title}</p>
          ${item.period ? `<p class="biz-period">${item.period}</p>` : ""}
          ${item.link
            ? `<a href="${item.link}" target="_blank" rel="noopener" class="biz-link">
                 공고 보기 →
               </a>`
            : ""}
        </div>
      `).join("")}
    </div>
  `;
}


/* ══════════════════════════════════════════════════════════
   7. 초기화 — 페이지 로드 완료 시 실행
   DOMContentLoaded: HTML 파싱 완료 이벤트 (이미지·CSS는 기다리지 않음)
   Promise.all: 여러 비동기 작업을 동시에 병렬 실행 (더 빠름)
   ══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  // 명언 표시 (동기, 즉시 실행)
  renderQuote();

  // "다른 명언 보기" 버튼
  document.getElementById("quote-btn")
    ?.addEventListener("click", renderQuote);

  // 나머지 섹션은 병렬로 JSON fetch 시작 (서로 기다리지 않음)
  Promise.all([
    renderWeather(),
    renderNews(),
    renderFinance(),
    renderBizinfo(),
  ]);

});
