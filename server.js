const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildAssistantReply } = require("./backend");
const config = require("./config.json");
const data = require("./data.json");

const PORT = process.env.PORT || config.port || 3000;
const FRONTEND_DIR = path.join(__dirname, "frontend");
const LEGACY_FRONTEND_FILE = path.join(__dirname, "frontend.html");
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", () => reject(new Error("Could not read request")));
  });
}

function serveStaticFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const type = CONTENT_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch (error) {
    sendJson(res, 404, { error: "File not found." });
  }
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || "/";
  const pathname = rawUrl.split("?")[0];

  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: config.appName });
  }

  if (req.method === "GET" && pathname === "/api/meta") {
    return sendJson(res, 200, {
      appName: config.appName,
      defaultSubject: config.defaultSubject,
      subjects: data.subjects
    });
  }

  if (req.method === "GET" && pathname === "/api/subjects") {
    return sendJson(res, 200, { subjects: data.subjects });
  }

  if (req.method === "GET" && pathname === "/api/tips") {
    return sendJson(res, 200, { tips: data.tips });
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    try {
      const body = await readBody(req);
      const message = String(body.message || "").trim();
      const subject = String(body.subject || config.defaultSubject).trim();

      if (!message) {
        return sendJson(res, 400, { error: "Message is required." });
      }

      const reply = await buildAssistantReply(message, subject);
      return sendJson(res, 200, { reply });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Failed to process chat request." });
    }
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return serveStaticFile(res, path.join(FRONTEND_DIR, "index.html"));
  }

  if (req.method === "GET" && pathname === "/frontend.html") {
    return serveStaticFile(res, LEGACY_FRONTEND_FILE);
  }

  if (req.method === "GET" && pathname.startsWith("/")) {
    const safePath = decodeURIComponent(pathname).replace(/^\/+/, "");
    const filePath = path.join(FRONTEND_DIR, safePath);
    if (filePath.startsWith(FRONTEND_DIR)) {
      return serveStaticFile(res, filePath);
    }
  }

  return sendJson(res, 404, { error: "Route not found." });
});

server.listen(PORT, () => {
  console.log(`${config.appName} running at http://localhost:${PORT}`);
});
