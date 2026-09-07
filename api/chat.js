/**
 * api/chat.js — Vercel 서버리스 함수 (Gemini 프록시)
 * ============================================================
 * 이 파일은 브라우저가 아니라 Vercel 서버에서 실행됩니다.
 * 따라서 process.env.GEMINI_API_KEY 는 방문자에게 절대 노출되지 않습니다.
 *
 *   브라우저 ──POST /api/chat──> (이 함수) ──키 첨부──> Gemini
 *              키 없음              키는 여기서만 존재
 *
 * 요청 형식  : { question: string, context?: [{q,a}], history?: [{role,text}] }
 * 응답 형식  : { answer: string }  /  { error: string }
 * ============================================================
 */

/* 모델은 환경변수로 교체 가능합니다 (GEMINI_MODEL).
   Google이 구세대 모델을 신규 사용자에게 차단하므로, 404가 나면
   응답 메시지가 안내하는 최신 모델명으로 .env / Vercel 환경변수만 바꾸면 됩니다.

   기본값으로 flash-lite 계열을 쓰는 이유 — 같은 질문 실측 결과:
     gemini-3.6-flash       35.0초   (추론을 꺼도 28초. 챗봇에는 너무 느림)
     gemini-3.5-flash       16.8초
     gemini-3.5-flash-lite   1.4초   ← 답변 품질은 충분하면서 25배 빠름          */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  GEMINI_MODEL +
  ":generateContent";

/* 답변 성격을 고정하는 시스템 지시문 */
const SYSTEM_PROMPT = [
  "당신은 'Daily Insights' 웹사이트의 한국어 AI 도우미입니다.",
  "주 전문 분야는 ChatGPT와 Claude Code 사용법이며, 초보자를 대상으로 안내합니다.",
  "",
  "규칙:",
  "1) '참고 FAQ'가 주어지면 그 내용을 최우선 근거로 삼아 답하세요.",
  "2) 참고 FAQ가 없거나 부족하면 일반 지식으로 답하되, 확실하지 않은 내용은",
  "   추측하지 말고 모른다고 솔직히 밝히세요.",
  "3) 3~6문장으로 간결하게. 단계 설명이 필요하면 번호 목록을 쓰세요.",
  "4) 마크다운 기호(**, ##, ``` 등)는 쓰지 말고 일반 문장으로 작성하세요.",
  "5) 항상 한국어 존댓말로 답하세요.",
].join("\n");

/* 입력 상한 — 남용 및 토큰 낭비 방지 */
const MAX_QUESTION_LEN = 300;
const MAX_CONTEXT_ITEMS = 3;
const MAX_CONTEXT_LEN = 700;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_LEN = 500;

function clip(value, len) {
  return String(value == null ? "" : value).slice(0, len);
}

/** req.body 가 문자열로 들어오는 런타임까지 대비 */
function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

/**
 * 요청 Origin을 판정합니다.
 *  - 같은 도메인(이 사이트 자체)은 항상 허용
 *  - 외부 도메인은 ALLOWED_ORIGINS 환경변수 목록에 있을 때만 허용
 *    예) ALLOWED_ORIGINS=https://jk0601.github.io,https://aish.co.kr
 *
 * @returns {string|null|false}
 *   문자열 = 허용된 Origin (CORS 헤더에 그대로 사용)
 *   null   = Origin 헤더 없음 (브라우저 외부 요청 — 통과)
 *   false  = 차단
 */
function resolveOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;

  let host;
  try {
    host = new URL(origin).host;
  } catch (e) {
    return false;
  }

  if (host === req.headers.host) return origin; // 같은 사이트

  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (s) { return s.trim().replace(/\/+$/, ""); })
    .filter(Boolean);

  return allowed.includes(origin.replace(/\/+$/, "")) ? origin : false;
}

module.exports = async function handler(req, res) {
  const origin = resolveOrigin(req);

  /* 허용된 외부 도메인에는 CORS 헤더를 붙여줍니다 */
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  /* 브라우저가 본 요청 전에 보내는 프리플라이트 */
  if (req.method === "OPTIONS") {
    if (origin === false) return res.status(403).end();
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  if (origin === false) {
    console.warn("[api/chat] 차단된 Origin:", req.headers.origin);
    return res.status(403).json({
      error: "허용되지 않은 도메인입니다. ALLOWED_ORIGINS 환경변수를 확인하세요.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[api/chat] GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    return res.status(500).json({ error: "서버에 API 키가 설정되지 않았습니다." });
  }

  const body = readBody(req);
  const question = clip(body.question, MAX_QUESTION_LEN).trim();
  if (!question) {
    return res.status(400).json({ error: "question 값이 비어 있습니다." });
  }

  /* 프론트에서 넘어온 FAQ 발췌를 근거 자료로 정리 */
  const contextItems = Array.isArray(body.context)
    ? body.context.slice(0, MAX_CONTEXT_ITEMS)
    : [];
  const contextText = contextItems.length
    ? "참고 FAQ:\n" +
      contextItems
        .map(function (item, i) {
          return (
            i +
            1 +
            ". Q: " +
            clip(item.q, 200) +
            "\n   A: " +
            clip(item.a, MAX_CONTEXT_LEN)
          );
        })
        .join("\n")
    : "참고 FAQ: 없음 (일반 지식으로 답변하세요)";

  /* 직전 대화 맥락 (선택) */
  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_TURNS).map(function (turn) {
        return {
          role: turn.role === "model" ? "model" : "user",
          parts: [{ text: clip(turn.text, MAX_HISTORY_LEN) }],
        };
      })
    : [];

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history.concat([
      {
        role: "user",
        parts: [{ text: contextText + "\n\n질문: " + question }],
      },
    ]),
    generationConfig: {
      temperature: 0.4,
      /* 추론(thinking) 토큰도 이 한도를 함께 소비하므로 넉넉히 잡습니다.
         부족하면 finishReason=MAX_TOKENS 와 함께 빈 답변이 돌아옵니다. */
      maxOutputTokens: 2048,
    },
  };

  try {
    const upstream = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      /* 키 등 민감 정보가 섞일 수 있으므로 원문은 서버 로그에만 남깁니다 */
      console.error("[api/chat] Gemini 오류", upstream.status, JSON.stringify(data));

      /* 자주 겪는 두 가지 상황은 로그에 해결 방법까지 남깁니다 */
      if (upstream.status === 404) {
        console.error(
          "  └ 모델 '" + GEMINI_MODEL + "' 을 쓸 수 없습니다. " +
          "위 메시지가 안내하는 모델명으로 GEMINI_MODEL 환경변수를 바꾸세요."
        );
      } else if (upstream.status === 403) {
        console.error(
          "  └ 키가 속한 Google 프로젝트가 차단된 상태입니다. " +
          "AI Studio(aistudio.google.com/apikey)에서 새 프로젝트로 키를 다시 발급해 보세요."
        );
      }

      return res
        .status(502)
        .json({ error: "AI 서비스 오류 (" + upstream.status + ")" });
    }

    const candidate = data.candidates && data.candidates[0];
    const answer = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts
          .map(function (p) { return p.text || ""; })
          .join("")
          .trim()
      : "";

    if (!answer) {
      const reason = (candidate && candidate.finishReason) || "UNKNOWN";
      console.warn("[api/chat] 빈 응답, finishReason =", reason);
      return res.status(502).json({
        error:
          reason === "SAFETY"
            ? "안전 정책에 따라 답변할 수 없는 질문입니다."
            : "AI가 답변을 생성하지 못했습니다.",
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ answer: answer });
  } catch (err) {
    console.error("[api/chat] 호출 실패", err);
    return res.status(502).json({ error: "AI 서비스에 연결하지 못했습니다." });
  }
};
