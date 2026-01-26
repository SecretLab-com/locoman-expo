import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cookie from "cookie";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerWebhookRoutes } from "./webhookRoutes";
import { registerStorefrontRoutes } from "./storefrontRoutes";
import { registerCronRoutes } from "./cronRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { COOKIE_NAME } from "@shared/const";
import { handleExpoRoute } from "./expoRoute";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // CORS middleware for Expo app (allows cross-origin requests with credentials)
  app.use("/api/trpc", (req, res, next) => {
    const origin = req.get('origin');
    // Allow requests from Expo dev server (port 8082) and Manus sandbox URLs
    const allowedOriginPatterns = [
      /^https?:\/\/localhost:8082$/,
      /^https?:\/\/8082-.*\.manus\.computer$/,
      /^https?:\/\/3000-.*\.manus\.computer$/, // Also allow same-origin for iframe
    ];
    
    if (origin && allowedOriginPatterns.some(pattern => pattern.test(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  
  // CORS middleware for storefront tracking (allows Shopify themes to call our API)
  app.use("/api/storefront", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Shopify webhook routes (must be before body parser for raw body access)
  registerWebhookRoutes(app);
  // Storefront API routes (CORS-enabled for Shopify themes)
  registerStorefrontRoutes(app);
  // Cron job routes for scheduled tasks
  registerCronRoutes(app);
  
  // Expo app page - serves the mobile app in an iframe
  app.get('/expo', handleExpoRoute);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
