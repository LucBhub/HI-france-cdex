const { createServer: createHttpsServer } = require("https");
const { createServer: createHttpServer } = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");
const httpProxy = require("http-proxy");

// Mettre en charge expressément les .env.local via le package officiel Next.js
// Ceci résout le problème de l'erreur DNS `EAI_AGAIN backend` sous Windows.
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Next.js has now loaded .env and .env.local into process.env
  const INTERNAL_API_URL =
    process.env.INTERNAL_API_URL || "http://backend:3002";
  console.log("[Server] INTERNAL_API_URL:", INTERNAL_API_URL);

  const FORCE_HTTP = process.env.FORCE_HTTP === "true";
  console.log("[Server] FORCE_HTTP:", FORCE_HTTP);

  // Create proxy for API requests
  const proxy = httpProxy.createProxyServer({
    target: INTERNAL_API_URL,
    changeOrigin: true,
    // Optional: add SSL check bypass if INTERNAL_API_URL is https
    secure: false,
  });

  proxy.on("proxyReq", (proxyReq) => {
    // Browser Origin is not meaningful once /api is proxied server-to-server.
    // Removing it keeps custom local frontend ports from tripping backend CORS.
    proxyReq.removeHeader("origin");
  });

  // Request handler
  const requestHandler = (req, res) => {
    const parsedUrl = parse(req.url, true);

    // Proxy /api/* requests to backend
    if (parsedUrl.pathname.startsWith("/api/")) {
      proxy.web(req, res, { target: INTERNAL_API_URL }, (err) => {
        console.error("[Proxy Error]", err.message);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Proxy Error", message: err.message }),
          );
        }
      });
      return;
    }

    handle(req, res, parsedUrl);
  };
  let server;
  let useHttps = false;

  // Check if we should use HTTPS
  if (!FORCE_HTTP) {
    try {
      const keyPath = path.join(__dirname, "certs/server.key");
      const certPath = path.join(__dirname, "certs/server.crt");

      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const httpsOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
        server = createHttpsServer(httpsOptions, requestHandler);
        useHttps = true;
        console.log("[Server] HTTPS mode enabled (certificates found)");
      }
    } catch (e) {
      console.log("[Server] HTTPS setup failed:", e.message);
    }
  }

  // Fallback to HTTP
  if (!server) {
    server = createHttpServer(requestHandler);
    console.log("[Server] HTTP mode enabled");
  }

  const listenPort = Number(process.env.FRONTEND_PORT || process.env.PORT || 3000);
  server.listen(listenPort, "0.0.0.0", (err) => {
    if (err) throw err;
    console.log(
      `> Ready on ${useHttps ? "https" : "http"}://0.0.0.0:${listenPort}`,
    );
  });
});
