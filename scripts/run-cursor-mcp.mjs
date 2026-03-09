#!/usr/bin/env node
/**
 * Cursor MCP launcher for the locomotivate-trainer assistant.
 *
 * Automatically generates a fresh Supabase Auth JWT for a trainer user on
 * every startup using the service-role key + admin API, so no manual token
 * management is needed.
 *
 * Required env (from .env):
 *   SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   LOCO_TRAINER_EMAIL  — email of the trainer account to authenticate as
 *
 * Optional:
 *   LOCO_API_BASE_URL / EXPO_PUBLIC_API_BASE_URL
 *   LOCO_IMPERSONATE_USER_ID
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const trainerEmail = process.env.LOCO_TRAINER_EMAIL || "";

if (!process.env.LOCO_API_BASE_URL) {
  process.env.LOCO_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
}

/**
 * Generate a fresh Supabase Auth JWT for the given email using:
 *   1. Admin generateLink (magic link) → returns an OTP token hash
 *   2. verifyOtp with that hash → returns a full session with access_token
 */
async function generateUserToken(email) {
  // Step 1: Generate a magic-link via the Admin API
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });

  if (!linkRes.ok) {
    const body = await linkRes.text();
    throw new Error(
      `generate_link failed (${linkRes.status}): ${body}`,
    );
  }

  const linkData = await linkRes.json();

  // The admin response includes the hashed token directly
  const tokenHash =
    linkData.properties?.hashed_token ||
    linkData.hashed_token ||
    extractTokenHashFromUrl(linkData.action_link);

  if (!tokenHash) {
    throw new Error(
      "Could not extract token hash from generate_link response",
    );
  }

  // Step 2: Verify the OTP to get a real session
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: tokenHash,
    }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    throw new Error(`verify failed (${verifyRes.status}): ${body}`);
  }

  const session = await verifyRes.json();
  const accessToken = session.access_token;
  if (!accessToken) {
    throw new Error("No access_token in verify response");
  }

  return accessToken;
}

function extractTokenHashFromUrl(actionLink) {
  if (!actionLink) return null;
  try {
    const url = new URL(actionLink);
    return url.searchParams.get("token_hash") || url.hash?.match(/token_hash=([^&]+)/)?.[1] || null;
  } catch {
    return null;
  }
}

async function main() {
  // If a valid JWT is already provided, skip auto-generation
  let token = process.env.LOCO_API_TOKEN || "";

  if (!token || !token.startsWith("eyJ")) {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error(
        "[cursor-mcp] Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY).",
      );
      process.exit(1);
    }
    if (!trainerEmail) {
      console.error(
        "[cursor-mcp] Set LOCO_TRAINER_EMAIL in .env to the trainer account email for auto-token generation.",
      );
      process.exit(1);
    }

    console.error(`[cursor-mcp] Generating fresh JWT for ${trainerEmail}...`);
    try {
      token = await generateUserToken(trainerEmail);
      console.error("[cursor-mcp] Token generated successfully.");
    } catch (err) {
      console.error(`[cursor-mcp] Token generation failed: ${err.message}`);
      process.exit(1);
    }
  }

  process.env.LOCO_API_TOKEN = token;
  process.env.MCP_STDIO_MODE = "1";

  const child = spawn("pnpm", ["mcp:trainer-assistant"], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[cursor-mcp] Failed to start MCP server:", error.message);
    process.exit(1);
  });
}

main();
