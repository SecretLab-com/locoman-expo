import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { logError, logEvent } from "./logger";
import { registerOAuthRoutes } from "./oauth";
import { setupWebSocket } from "./websocket";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");

  setupWebSocket(server);

  server.listen(preferredPort, () => {
    logEvent("server.started", { port: preferredPort });
    logEvent("websocket.ready", { url: `ws://localhost:${preferredPort}/ws` });
  });
  server.on("error", (error) => {
    logError("server.start_failed", error, { port: preferredPort });
    process.exit(1);
  });
}

startServer().catch(console.error);
