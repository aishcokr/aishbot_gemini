/**
 * chatbot.js — FAQ 사이드 챗봇 (키워드 검색 + Gemini AI 폴백)
 * ============================================================
 * 동작 순서
 *   ① data/faq.json 키워드 검색 → 매칭이 확실하면 그대로 답변 (AI 호출 없음)
 *   ② 매칭이 약하거나 없으면 /api/chat 으로 Gemini에게 질문
 *
 * API 키는 Vercel 서버리스 함수(api/chat.js)에만 있으며,
 * 이 파일에는 절대 키가 들어가지 않습니다.
 * ============================================================
 */
(function () {
  "use strict";

  const btnToggle = document.getElementById("chatbot-toggle");
  const btnClose  = document.getElementById("chatbot-close");
  const panel     = document.getElementById("chatbot-panel");
  const backdrop  = document.getElementById("chatbot-backdrop");
  const messages  = document.getElementById("chatbot-messages");
  const input     = document.getElementById("chatbot-input");
  const btnSend   = document.getElementById("chatbot-send");

  let faqData = [];
  let isOpen  = false;

  const SCORE_GOOD  = 4;
  const SCORE_WEAK  = 1;
  const MAX_RESULTS = 3;

  /* ── Gemini(AI) 설정 ──────────────────────────────────────
     AI_ENDPOINT 는 같은 도메인의 서버리스 함수라 CORS·키가 모두 불필요합니다.
     로컬에서 테스트하려면 `npx vercel dev` 로 띄우세요.
     (python -m http.server 로는 /api/chat 이 404 입니다)             */
  const AI_ENDPOINT   = "/api/chat";
  const AI_TIMEOUT_MS = 25000;   // 응답 대기 상한
  const AI_MAX_CALLS  = 30;      // 세션당 호출 상한 (할당량 보호)
  const AI_CONTEXT_N  = 3;       // AI에 함께 넘길 FAQ 발췌 개수
  const AI_HISTORY_N  = 6;       // 유지할 대화 기록 (user+model 합계)

  let aiCallCount = 0;
  let aiBusy      = false;
  const aiHistory = [];

  function openPanel() {
    isOpen = true;
    panel.classList.add("open");
    backdrop.classList.add("active");
    btnToggle.classList.add("hidden");
    input.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove("open");
    backdrop.classList.remove("active");
    btnToggle.classList.remove("hidden");
  }

  if (btnToggle) btnToggle.addEventListener("click", openPanel);
  if (btnClose)  btnClose.addEventListener("click", closePanel);
  if (backdrop)  backdrop.addEventListener("click", closePanel);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });

  function addMessage(role, html) {
    const div = document.createElement("div");
    div.className = "msg msg--" + role;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function addUserMessage(text) {
    addMessage("user", escHtml(text));
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** AI 응답 대기 중 입력 잠금 */
  function setBusy(busy) {
    aiBusy = busy;
    if (input)   input.disabled   = busy;
    if (btnSend) btnSend.disabled = busy;
    if (!busy && isOpen && input) input.focus();
  }

  function tokenize(text) {
    const tokens = text.match(/[가-힣a-zA-Z0-9/]{2,}|[/]/g) || [];
    const stopwords = new Set(["있나요", "있을", "있는", "무엇", "어떻게", "인가요", "하나요", "되나요", "인지", "이란"]);
    return tokens.filter(function (t) { return !stopwords.has(t); });
  }

  function searchFAQ(query) {
    if (faqData.length === 0) return [];

    const trimmed = query.trim().toLowerCase();

    const exactMatch = faqData.find(function (item) {
      return item.q.trim().toLowerCase() === trimmed;
    });
    if (exactMatch) {
      return [{ item: exactMatch, score: SCORE_GOOD }];
    }

    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const scored = faqData.map(function (item) {
      let score = 0;
      tokens.forEach(function (token) {
        const t = token.toLowerCase();
        if (item.q.toLowerCase().includes(t)) score += 3;
        if (item.tags && item.tags.some(function (tag) {
          return tag.toLowerCase().includes(t);
        })) score += 2;
        if (item.a.toLowerCase().includes(t)) score += 1;
      });
      return { item: item, score: score };
    });

    return scored
      .filter(function (r) { return r.score >= SCORE_WEAK; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, MAX_RESULTS);
  }

  /**
   * /api/chat 호출. 키는 서버에만 있으므로 여기서는 질문·근거만 보냅니다.
   * @returns {Promise<string>} AI가 생성한 답변 텍스트
   */
  async function askAI(question, contextResults) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);

    try {
      const res = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question: question,
          context: contextResults.map(function (r) {
            return { q: r.item.q, a: r.item.a };
          }),
          history: aiHistory.slice(-AI_HISTORY_N),
        }),
      });

      const data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        throw new Error(data.error || "AI 응답 실패 (" + res.status + ")");
      }
      if (!data.answer) {
        throw new Error("AI가 빈 응답을 반환했습니다.");
      }
      return data.answer;
    } finally {
      clearTimeout(timer);
    }
  }

  async function renderAnswer(results, query) {
    const best = results[0];

    /* ① FAQ에 확실한 답이 있으면 그대로 사용 — AI 호출 없음 (비용 0) */
    if (best && best.score >= SCORE_GOOD) {
      addMessage("bot", `
        <p><strong>Q. ${escHtml(best.item.q)}</strong></p>
        <div class="answer-card">${escHtml(best.item.a)}</div>
      `);
      if (results.length > 1) appendRelatedButtons(results.slice(1));
      return;
    }

    /* ② FAQ에 없거나 애매한 경우 → Gemini에게 위임 */
    if (aiCallCount >= AI_MAX_CALLS) {
      addMessage("bot", "<p>이번 세션의 AI 답변 횟수를 모두 사용했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>");
      if (results.length) appendRelatedButtons(results);
      else appendSuggestedButtons();
      return;
    }

    aiCallCount++;
    setBusy(true);

    const bubble = addMessage("bot", `
      <p class="ai-thinking">
        <span class="ai-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        AI가 답변을 작성 중입니다…
      </p>
    `);

    try {
      const answer = await askAI(query, results.slice(0, AI_CONTEXT_N));

      bubble.innerHTML = `
        <p class="ai-badge">✨ AI 생성 답변</p>
        <div class="answer-card">${escHtml(answer)}</div>
      `;

      aiHistory.push({ role: "user",  text: query });
      aiHistory.push({ role: "model", text: answer });
      if (aiHistory.length > AI_HISTORY_N) {
        aiHistory.splice(0, aiHistory.length - AI_HISTORY_N);
      }

      if (results.length) appendRelatedButtons(results);
    } catch (err) {
      const reason = err.name === "AbortError"
        ? "응답이 너무 오래 걸려 중단했습니다."
        : err.message;
      console.warn("[chatbot.js] AI 폴백 실패:", reason);

      bubble.innerHTML = `
        <p>죄송합니다. 지금은 답변을 가져오지 못했어요.</p>
        <p class="ai-error">${escHtml(reason)}</p>
      `;
      if (results.length) appendRelatedButtons(results);
      else appendSuggestedButtons();
    } finally {
      setBusy(false);
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function appendRelatedButtons(results) {
    const wrapper = document.createElement("div");
    wrapper.className = "msg msg--bot";

    let html = "<p>관련 항목:</p>";
    results.forEach(function (r) {
      html += `<button type="button" class="related-btn" data-q="${escHtml(r.item.q)}">${escHtml(r.item.q)}</button>`;
    });
    wrapper.innerHTML = html;

    wrapper.querySelectorAll(".related-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleQuery(btn.getAttribute("data-q"));
      });
    });

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendSuggestedButtons() {
    const suggestions = [
      "ChatGPT가 무엇인가요?",
      "프롬프트 공식을 알려주세요",
      "클로드 코드 설치 방법",
      "파일 업로드 활용법",
    ];

    const wrapper = document.createElement("div");
    wrapper.className = "suggested-questions";

    suggestions.forEach(function (q) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "suggest-btn";
      btn.textContent = q;
      btn.addEventListener("click", function () {
        handleQuery(q);
      });
      wrapper.appendChild(btn);
    });

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleQuery(query) {
    if (aiBusy) return;                    // 답변 생성 중에는 중복 질문 차단

    const trimmed = query.trim();
    if (!trimmed) return;

    addUserMessage(trimmed);
    input.value = "";

    /* faq.json 로드 실패 시에도 AI 폴백으로 답변이 가능하므로 그대로 진행합니다 */
    await renderAnswer(searchFAQ(trimmed), trimmed);
  }

  if (btnSend) {
    btnSend.addEventListener("click", function () {
      handleQuery(input.value);
    });
  }

  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleQuery(input.value);
      }
    });
  }

  document.querySelectorAll(".suggest-btn[data-q]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      handleQuery(btn.getAttribute("data-q"));
    });
  });

  async function init() {
    try {
      /* 브라우저가 예전 faq.json을 붙잡지 않도록 캐시 우회 */
      const res = await fetch("data/faq.json?t=" + Date.now(), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("faq.json 로드 실패 (" + res.status + ")");
      faqData = await res.json();
      if (!Array.isArray(faqData) || faqData.length === 0) {
        throw new Error("faq.json 형식 오류 또는 빈 배열");
      }
      console.info("[chatbot.js] FAQ 로드 완료:", faqData.length + "개 항목");
    } catch (err) {
      /* FAQ가 없어도 AI 폴백만으로 챗봇은 동작합니다 */
      console.warn("[chatbot.js]", err.message, "— AI 답변으로만 동작합니다.");
      faqData = [];
    }
  }

  init();
})();
