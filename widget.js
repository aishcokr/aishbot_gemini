/**
 * widget.js — 임베드형 AI 도우미 위젯 (외부 사이트용)
 * ============================================================
 * 다른 사이트(예: https://jk0601.github.io/aish/)에 아래 한 줄만 넣으면
 * 버튼·패널이 자동으로 생성됩니다. HTML·CSS를 손댈 필요가 없습니다.
 *
 *   <script src="https://<프로젝트>.vercel.app/widget.js" defer></script>
 *
 * 선택 옵션 (script 태그의 data-* 속성):
 *   data-api      호출할 API 주소   (기본: 이 스크립트가 있는 도메인 + /api/chat)
 *   data-faq      FAQ JSON 주소     (기본: 이 스크립트가 있는 도메인 + /data/faq.json)
 *   data-title    패널 제목         (기본: "AI 도우미")
 *   data-subtitle 패널 부제         (기본: "FAQ + Gemini AI")
 *   data-greeting 첫 인사말
 *
 * 설계 메모
 *  - Shadow DOM 안에 렌더링합니다. 호스트 사이트의 CSS가 위젯에 침투하지 못하고,
 *    위젯 CSS도 밖으로 새어나가지 않습니다. 남의 페이지에 붙일 때 필수입니다.
 *  - API 키는 이 파일에 없습니다. 서버(api/chat.js)만 키를 압니다.
 * ============================================================
 */
(function () {
  "use strict";

  /* 같은 페이지에 두 번 삽입돼도 한 번만 동작 */
  if (window.__aishAiWidgetLoaded) return;
  window.__aishAiWidgetLoaded = true;

  /* ── 설정 ─────────────────────────────────────────────── */
  const SCRIPT = document.currentScript || (function () {
    const list = document.querySelectorAll('script[src*="widget.js"]');
    return list[list.length - 1] || null;
  })();

  /* 스크립트 자신의 주소에서 서버 위치를 추론 — 설정 없이도 동작합니다 */
  let BASE = "";
  try {
    BASE = new URL(SCRIPT.src, location.href).origin;
  } catch (e) {
    BASE = location.origin;
  }

  const ds = (SCRIPT && SCRIPT.dataset) || {};
  const CFG = {
    api:      ds.api      || BASE + "/api/chat",
    faq:      ds.faq      || BASE + "/data/faq.json",
    title:    ds.title    || "AI 도우미",
    subtitle: ds.subtitle || "FAQ + Gemini AI",
    greeting: ds.greeting || "안녕하세요! ChatGPT · Claude Code 사용법을 안내해 드리는 AI 도우미입니다.",
  };

  const SCORE_GOOD  = 4;
  const SCORE_WEAK  = 1;
  const MAX_RESULTS = 3;

  const AI_TIMEOUT_MS = 25000;
  const AI_MAX_CALLS  = 30;
  const AI_CONTEXT_N  = 3;
  const AI_HISTORY_N  = 6;

  const SUGGESTIONS = [
    "ChatGPT가 무엇인가요?",
    "좋은 프롬프트 공식이 뭔가요?",
    "클로드 코드란 무엇인가요?",
    "파일을 업로드하면 무엇을 할 수 있나요?",
  ];

  let faqData     = [];
  let isOpen      = false;
  let aiCallCount = 0;
  let aiBusy      = false;
  const aiHistory = [];

  /* ── 스타일 (Shadow DOM 내부에만 적용) ─────────────────── */
  const CSS = `
:host {
  all: initial;
  display: block;
  font-family: 'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',
               system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  line-height: 1.6;
  color: #1a1a1c;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 22px 11px 12px;
  background: linear-gradient(135deg, #4c8264 0%, #1e3a2b 100%);
  color: #fff;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 2.2rem;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 10px 30px -6px rgba(30,58,43,.38),
              0 2px 8px rgba(0,0,0,.10),
              inset 0 1px 0 rgba(255,255,255,.18);
  transition: transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s, opacity .25s;
}
.fab:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 40px -8px rgba(30,58,43,.38),
              0 0 0 4px rgba(120,200,155,.16),
              0 3px 10px rgba(0,0,0,.14),
              inset 0 1px 0 rgba(255,255,255,.26);
}
.fab:active { transform: translateY(-1px) scale(.985); }
.fab:focus-visible { outline: 2px solid #b9ecd0; outline-offset: 3px; }
.fab.hidden { opacity: 0; transform: translateY(8px) scale(.96); pointer-events: none; }

.fab-icon {
  display: flex; align-items: center; justify-content: center;
  width: 2.1rem; height: 2.1rem; flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255,255,255,.13);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.16);
  color: #b9ecd0;
}
.fab-icon svg { width: 1.15rem; height: 1.15rem; transition: transform .45s cubic-bezier(.4,0,.2,1); }
.fab:hover .fab-icon svg { transform: rotate(90deg) scale(1.06); }

.fab-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.25; text-align: left; }
.fab-text strong { font-size: .88rem; font-weight: 600; letter-spacing: -.01em; }
.fab-text em { font-style: normal; font-size: .66rem; opacity: .62; }

.fab-status {
  position: absolute; top: 10px; right: 13px;
  width: 6px; height: 6px; border-radius: 50%;
  background: #b9ecd0;
  animation: ping 2.6s ease-out infinite;
}
@keyframes ping {
  0%       { box-shadow: 0 0 0 0   rgba(185,236,208,.65); }
  70%,100% { box-shadow: 0 0 0 7px rgba(185,236,208,0); }
}

.backdrop {
  display: none; position: fixed; inset: 0;
  z-index: 2147483001;
  background: rgba(0,0,0,.35);
  opacity: 0; transition: opacity .3s;
}
.backdrop.active { display: block; opacity: 1; }

.panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 380px; max-width: 100vw;
  z-index: 2147483002;
  display: flex; flex-direction: column;
  background: #fff;
  box-shadow: -4px 0 30px rgba(0,0,0,.12);
  transform: translateX(110%);
  transition: transform .35s cubic-bezier(.4,0,.2,1);
}
.panel.open { transform: translateX(0); }

.head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 17px 20px;
  background: linear-gradient(135deg, #4c8264 0%, #1e3a2b 115%);
  color: #fff; flex-shrink: 0;
}
.head-info { display: flex; align-items: center; gap: 11px; }
.avatar {
  display: flex; align-items: center; justify-content: center;
  width: 2.2rem; height: 2.2rem; flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255,255,255,.14);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
  color: #b9ecd0;
}
.avatar svg { width: 1.2rem; height: 1.2rem; }
.head strong { display: block; font-size: .95rem; line-height: 1.25; }
.head small { font-size: .72rem; opacity: .8; }
.close {
  width: 2rem; height: 2rem;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,.15);
  color: #fff; font-size: 1rem; font-family: inherit; cursor: pointer;
  transition: background .2s;
}
.close:hover { background: rgba(255,255,255,.3); }

.msgs {
  flex: 1; overflow-y: auto; padding: 18px;
  display: flex; flex-direction: column; gap: 12px;
  scroll-behavior: smooth;
  background: #fff;
}
.msg {
  max-width: 85%; padding: 10px 14px;
  border-radius: 14px; font-size: .84rem;
}
.msg p + p { margin-top: 6px; }
.msg--bot  { align-self: flex-start; background: #f0efe9; color: #1a1a1c; border-bottom-left-radius: 4px; }
.msg--user { align-self: flex-end;   background: #3d6b4f; color: #fff;    border-bottom-right-radius: 4px; }

.card {
  background: #faf9f6;
  border-left: 3px solid #3d6b4f;
  padding: 10px 12px;
  border-radius: 0 8px 8px 0;
  font-size: .85rem; line-height: 1.7;
  white-space: pre-line;
}
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  margin-bottom: 6px; padding: 2px 8px;
  background: rgba(61,107,79,.09); color: #3d6b4f;
  border: 1px solid rgba(61,107,79,.35);
  border-radius: 1rem; font-size: .68rem; font-weight: 600;
}
.thinking { display: flex; align-items: center; gap: 8px; color: #92929e; font-size: .8rem; }
.dots { display: inline-flex; gap: 3px; }
.dots i {
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(61,107,79,.35);
  animation: bounce 1.2s infinite ease-in-out;
}
.dots i:nth-child(2) { animation-delay: .15s; }
.dots i:nth-child(3) { animation-delay: .30s; }
@keyframes bounce {
  0%,60%,100% { transform: translateY(0);    opacity: .45; }
  30%         { transform: translateY(-4px); opacity: 1;   }
}
.err { margin-top: 4px; font-size: .7rem; color: #92929e; }

.suggests { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; }
.suggest {
  padding: 6px 12px;
  background: rgba(61,107,79,.09); color: #3d6b4f;
  border: 1px solid rgba(61,107,79,.35);
  border-radius: 1rem;
  font-family: inherit; font-size: .75rem; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: background .2s, transform .2s;
}
.suggest:hover { background: rgba(61,107,79,.16); transform: translateY(-1px); }

.related {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; margin-top: 6px;
  background: #faf9f6; border: 1px solid #e5e3dc;
  border-radius: 8px;
  font-family: inherit; font-size: .78rem; color: #1a1a1c;
  cursor: pointer;
}
.related:hover { background: #f0efe9; }
.related::before { content: "→ "; color: #3d6b4f; }

.input-area {
  display: flex; gap: 8px; padding: 14px;
  border-top: 1px solid #e5e3dc; background: #fff; flex-shrink: 0;
}
.input {
  flex: 1; padding: 10px 14px;
  border: 1px solid #e5e3dc; border-radius: 1.5rem;
  font-family: inherit; font-size: .86rem;
  outline: none; background: #faf9f6; color: #1a1a1c;
  transition: border-color .2s, box-shadow .2s;
}
.input:focus { border-color: #3d6b4f; box-shadow: 0 0 0 3px rgba(61,107,79,.09); background: #fff; }
.input:disabled { background: #f0efe9; color: #92929e; cursor: not-allowed; }
.send {
  width: 2.4rem; height: 2.4rem;
  border: none; border-radius: 50%;
  background: #3d6b4f; color: #fff; font-size: .9rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; cursor: pointer; font-family: inherit;
  transition: background .2s, transform .2s;
}
.send:hover:not(:disabled) { background: #2f543d; transform: scale(1.05); }
.send:disabled { background: rgba(61,107,79,.35); cursor: not-allowed; }

.disclaimer {
  font-size: .65rem; color: #92929e; text-align: center;
  padding: 0 14px 12px; flex-shrink: 0; line-height: 1.4;
}

@media (max-width: 760px) {
  .fab { bottom: 20px; right: 16px; padding: 10px; gap: 0; border-radius: 50%; }
  .fab-text { display: none; }
  .fab-status { top: 6px; right: 6px; }
  .panel { width: 100vw; }
}
@media (prefers-reduced-motion: reduce) {
  .fab-status, .dots i { animation: none; }
  .fab:hover .fab-icon svg { transform: none; }
}
`;

  const SPARKLE = '<svg viewBox="0 0 24 24" fill="currentColor" focusable="false">' +
    '<path d="M12 1.8l1.6 4.7a4.2 4.2 0 0 0 2.6 2.6l4.7 1.6-4.7 1.6a4.2 4.2 0 0 0-2.6 2.6L12 19.6l-1.6-4.7a4.2 4.2 0 0 0-2.6-2.6L3.1 10.7l4.7-1.6a4.2 4.2 0 0 0 2.6-2.6L12 1.8z"/>' +
    '<path d="M18.7 15.6l.66 1.94a1.7 1.7 0 0 0 1.06 1.06l1.94.66-1.94.66a1.7 1.7 0 0 0-1.06 1.06l-.66 1.94-.66-1.94a1.7 1.7 0 0 0-1.06-1.06l-1.94-.66 1.94-.66a1.7 1.7 0 0 0 1.06-1.06l.66-1.94z" opacity=".65"/>' +
    "</svg>";

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── DOM 생성 ─────────────────────────────────────────── */
  const host = document.createElement("div");
  host.setAttribute("data-aish-ai-widget", "");
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button type="button" class="fab" part="fab" aria-label="${escHtml(CFG.title)} 열기">
      <span class="fab-icon" aria-hidden="true">${SPARKLE}</span>
      <span class="fab-text">
        <strong>${escHtml(CFG.title)}</strong>
        <em>무엇이든 물어보세요</em>
      </span>
      <span class="fab-status" aria-hidden="true"></span>
    </button>

    <div class="backdrop"></div>

    <aside class="panel" role="complementary" aria-label="${escHtml(CFG.title)}">
      <div class="head">
        <div class="head-info">
          <span class="avatar" aria-hidden="true">${SPARKLE}</span>
          <div>
            <strong>${escHtml(CFG.title)}</strong>
            <small>${escHtml(CFG.subtitle)}</small>
          </div>
        </div>
        <button type="button" class="close" aria-label="닫기">✕</button>
      </div>

      <div class="msgs"></div>

      <div class="input-area">
        <input type="text" class="input" placeholder="질문을 입력하세요..." autocomplete="off" maxlength="200" />
        <button type="button" class="send" aria-label="전송">➤</button>
      </div>

      <p class="disclaimer">
        교육용 안내입니다. FAQ에 없는 질문은 Gemini AI가 생성하며,
        부정확할 수 있으니 최신 정보는 공식 문서를 확인하세요.
      </p>
    </aside>
  `;
  while (wrap.firstChild) root.appendChild(wrap.firstChild);

  const $ = function (sel) { return root.querySelector(sel); };
  const elFab      = $(".fab");
  const elBackdrop = $(".backdrop");
  const elPanel    = $(".panel");
  const elMsgs     = $(".msgs");
  const elInput    = $(".input");
  const elSend     = $(".send");
  const elClose    = $(".close");

  function mount() {
    document.body.appendChild(host);
    addMessage("bot", `
      <p>${escHtml(CFG.greeting)}</p>
      <p>등록된 FAQ에 없는 질문은 <strong>Gemini AI</strong>가 대신 답변해 드립니다.</p>
    `);
    appendSuggestions();
    loadFaq();
  }

  /* ── 패널 열고 닫기 ───────────────────────────────────── */
  function openPanel() {
    isOpen = true;
    elPanel.classList.add("open");
    elBackdrop.classList.add("active");
    elFab.classList.add("hidden");
    elInput.focus();
  }
  function closePanel() {
    isOpen = false;
    elPanel.classList.remove("open");
    elBackdrop.classList.remove("active");
    elFab.classList.remove("hidden");
  }

  elFab.addEventListener("click", openPanel);
  elClose.addEventListener("click", closePanel);
  elBackdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });

  /* ── 메시지 렌더링 ────────────────────────────────────── */
  function addMessage(role, html) {
    const div = document.createElement("div");
    div.className = "msg msg--" + role;
    div.innerHTML = html;
    elMsgs.appendChild(div);
    elMsgs.scrollTop = elMsgs.scrollHeight;
    return div;
  }

  function appendSuggestions() {
    const box = document.createElement("div");
    box.className = "suggests";
    SUGGESTIONS.forEach(function (q) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggest";
      b.textContent = q;
      b.addEventListener("click", function () { handleQuery(q); });
      box.appendChild(b);
    });
    elMsgs.appendChild(box);
    elMsgs.scrollTop = elMsgs.scrollHeight;
  }

  function appendRelated(results) {
    const box = document.createElement("div");
    box.className = "msg msg--bot";
    let html = "<p>관련 항목:</p>";
    results.forEach(function (r) {
      html += `<button type="button" class="related" data-q="${escHtml(r.item.q)}">${escHtml(r.item.q)}</button>`;
    });
    box.innerHTML = html;
    box.querySelectorAll(".related").forEach(function (b) {
      b.addEventListener("click", function () { handleQuery(b.getAttribute("data-q")); });
    });
    elMsgs.appendChild(box);
    elMsgs.scrollTop = elMsgs.scrollHeight;
  }

  function setBusy(busy) {
    aiBusy = busy;
    elInput.disabled = busy;
    elSend.disabled  = busy;
    if (!busy && isOpen) elInput.focus();
  }

  /* ── FAQ 검색 ─────────────────────────────────────────── */
  function tokenize(text) {
    const tokens = text.match(/[가-힣a-zA-Z0-9/]{2,}|[/]/g) || [];
    const stop = new Set(["있나요","있을","있는","무엇","어떻게","인가요","하나요","되나요","인지","이란"]);
    return tokens.filter(function (t) { return !stop.has(t); });
  }

  function searchFAQ(query) {
    if (faqData.length === 0) return [];

    const trimmed = query.trim().toLowerCase();
    const exact = faqData.find(function (i) { return i.q.trim().toLowerCase() === trimmed; });
    if (exact) return [{ item: exact, score: SCORE_GOOD }];

    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    return faqData
      .map(function (item) {
        let score = 0;
        tokens.forEach(function (token) {
          const t = token.toLowerCase();
          if (item.q.toLowerCase().includes(t)) score += 3;
          if (item.tags && item.tags.some(function (tag) { return tag.toLowerCase().includes(t); })) score += 2;
          if (item.a.toLowerCase().includes(t)) score += 1;
        });
        return { item: item, score: score };
      })
      .filter(function (r) { return r.score >= SCORE_WEAK; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, MAX_RESULTS);
  }

  /* ── AI 호출 ──────────────────────────────────────────── */
  async function askAI(question, contextResults) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);
    try {
      const res = await fetch(CFG.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question: question,
          context: contextResults.map(function (r) { return { q: r.item.q, a: r.item.a }; }),
          history: aiHistory.slice(-AI_HISTORY_N),
        }),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok)     throw new Error(data.error || "AI 응답 실패 (" + res.status + ")");
      if (!data.answer) throw new Error("AI가 빈 응답을 반환했습니다.");
      return data.answer;
    } finally {
      clearTimeout(timer);
    }
  }

  async function renderAnswer(results, query) {
    const best = results[0];

    if (best && best.score >= SCORE_GOOD) {
      addMessage("bot", `
        <p><strong>Q. ${escHtml(best.item.q)}</strong></p>
        <div class="card">${escHtml(best.item.a)}</div>
      `);
      if (results.length > 1) appendRelated(results.slice(1));
      return;
    }

    if (aiCallCount >= AI_MAX_CALLS) {
      addMessage("bot", "<p>이번 세션의 AI 답변 횟수를 모두 사용했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>");
      if (results.length) appendRelated(results); else appendSuggestions();
      return;
    }

    aiCallCount++;
    setBusy(true);
    const bubble = addMessage("bot",
      '<p class="thinking"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>AI가 답변을 작성 중입니다…</p>');

    try {
      const answer = await askAI(query, results.slice(0, AI_CONTEXT_N));
      bubble.innerHTML = `
        <p class="badge">✨ AI 생성 답변</p>
        <div class="card">${escHtml(answer)}</div>
      `;
      aiHistory.push({ role: "user", text: query });
      aiHistory.push({ role: "model", text: answer });
      if (aiHistory.length > AI_HISTORY_N) aiHistory.splice(0, aiHistory.length - AI_HISTORY_N);
      if (results.length) appendRelated(results);
    } catch (err) {
      const reason = err.name === "AbortError"
        ? "응답이 너무 오래 걸려 중단했습니다."
        : err.message;
      console.warn("[ai-widget]", reason);
      bubble.innerHTML = `
        <p>죄송합니다. 지금은 답변을 가져오지 못했어요.</p>
        <p class="err">${escHtml(reason)}</p>
      `;
      if (results.length) appendRelated(results); else appendSuggestions();
    } finally {
      setBusy(false);
      elMsgs.scrollTop = elMsgs.scrollHeight;
    }
  }

  async function handleQuery(query) {
    if (aiBusy) return;
    const trimmed = String(query || "").trim();
    if (!trimmed) return;

    addMessage("user", escHtml(trimmed));
    elInput.value = "";
    await renderAnswer(searchFAQ(trimmed), trimmed);
  }

  elSend.addEventListener("click", function () { handleQuery(elInput.value); });
  elInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery(elInput.value);
    }
  });

  /* ── FAQ 로드 ─────────────────────────────────────────── */
  async function loadFaq() {
    try {
      const res = await fetch(CFG.faq + (CFG.faq.includes("?") ? "&" : "?") + "t=" + Date.now(),
                              { cache: "no-store" });
      if (!res.ok) throw new Error("FAQ 로드 실패 (" + res.status + ")");
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error("FAQ 형식 오류");
      faqData = json;
    } catch (err) {
      /* FAQ를 못 읽어도 AI 답변만으로 동작합니다 */
      console.warn("[ai-widget]", err.message, "— AI 답변으로만 동작합니다.");
      faqData = [];
    }
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
