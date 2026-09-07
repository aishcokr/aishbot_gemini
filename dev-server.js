/**
 * dev-server.js — 로컬 개발 서버 (의존성 0개, Node.js 18+)
 * ============================================================
 * Vercel 계정·로그인·GitHub 업로드 없이 로컬에서 바로 실행합니다.
 *
 *   1) .env 파일에 GEMINI_API_KEY=... 를 넣고
 *   2) node dev-server.js
 *   3) http://localhost:3000 접속
 *
 * 정적 파일(index.html·CSS·JS·data/*.json)을 서빙하고,
 * /api/chat 요청만 api/chat.js 로 넘겨 Vercel과 동일하게 동작시킵니다.
 * 배포 시에는 이 파일이 쓰이지 않습니다 (Vercel이 api/ 를 직접 실행).
 * ============================================================
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

/* ── .env 로드 (dotenv 없이 직접 파싱) ───────────────────── */
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return false;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const eq = trimmed.indexOf("=");
    if (eq === -1) return;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    /* 값을 감싼 따옴표 제거 */
    if (
      (value.startsWith('"')  && value.endsWith('"')) ||
      (value.startsWith("'")  && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    /* 이미 셸에서 지정한 환경변수가 우선 */
    if (!(key in process.env)) process.env[key] = value;
  });
  return true;
}

const envLoaded = loadEnv();

/* ── 정적 파일 MIME 매핑 ─────────────────────────────────── */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".pdf":  "application/pdf",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".txt":  "text/plain; charset=utf-8",
};

/* ── Vercel 함수 시그니처 흉내내기 (res.status().json()) ──── */
function decorate(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return raw; // api/chat.js 의 readBody() 가 문자열도 처리합니다
  }
}

async function handleApi(req, res) {
  /* 매 요청마다 새로 불러와, 함수 수정 시 서버 재시작이 필요 없게 합니다 */
  const modulePath = require.resolve("./api/chat.js");
  delete require.cache[modulePath];
  const handler = require(modulePath);

  try {
    req.body = await readRequestBody(req);
    await handler(req, decorate(res));
  } catch (err) {
    console.error("[dev-server] /api/chat 처리 실패:", err);
    if (!res.headersSent) {
      decorate(res).status(500).json({ error: "개발 서버 내부 오류" });
    }
  }
}

function serveStatic(pathname, res) {
  /* 상위 디렉터리 탈출 차단 */
  const safe = path
    .normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(ROOT, safe);

  if (!filePath.startsWith(ROOT)) {
    return decorate(res).status(403).json({ error: "Forbidden" });
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("404 Not Found: " + pathname);
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store"); // 개발 중에는 캐시 비활성화
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(function (req, res) {
  const pathname = new URL(req.url, "http://" + (req.headers.host || "localhost")).pathname;

  if (pathname === "/api/chat") {
    handleApi(req, res);
    return;
  }
  serveStatic(pathname === "/" ? "/index.html" : pathname, res);
});

/* ── 실행 전 환경 점검 ───────────────────────────────────── */
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) {
  console.error("✗ Node.js 18 이상이 필요합니다. 현재: v" + process.versions.node);
  process.exit(1);
}

server.listen(PORT, function () {
  console.log("");
  console.log("  Daily Insights — 로컬 개발 서버");
  console.log("  ───────────────────────────────────────────");
  console.log("  주소      http://localhost:" + PORT);
  console.log("  .env      " + (envLoaded ? "로드됨" : "없음 (.env.example 참고)"));
  console.log(
    "  Gemini    " +
      (process.env.GEMINI_API_KEY
        ? "키 설정됨 — AI 답변 사용 가능"
        : "키 없음 — FAQ 검색만 동작합니다")
  );
  console.log("  ───────────────────────────────────────────");
  console.log("  종료: Ctrl + C");
  console.log("");
});
