#!/usr/bin/env node
/**
 * Generate a Supabase user access token (JWT) for a given email.
 *
 * Uses:
 *   1) Admin generate_link (magiclink) to get token_hash
 *   2) Auth verify to exchange token_hash for access_token
 *
 * Required env vars:
 *   SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage:
 *   node scripts/get-user-access-token.mjs jason@secretlab.com
 *   node scripts/get-user-access-token.mjs jason@secretlab.com --json
 */
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

function parseArgs(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter(
    (value) => value !== "--json" && value !== "--",
  );
  return {
    email: positional[0] || process.env.LOCO_USER_EMAIL || "",
    json,
  };
}

function extractTokenHashFromUrl(actionLink) {
  if (!actionLink) return null;
  try {
    const url = new URL(actionLink);
    return (
      url.searchParams.get("token_hash") ||
      url.hash?.match(/token_hash=([^&]+)/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

function decodeJwtExpiryIso(token) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );
    if (!payload?.exp || !Number.isFinite(payload.exp)) return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

async function generateUserToken(email) {
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
    throw new Error(`generate_link failed (${linkRes.status}): ${body}`);
  }

  const linkData = await linkRes.json();
  const tokenHash =
    linkData.properties?.hashed_token ||
    linkData.hashed_token ||
    extractTokenHashFromUrl(linkData.action_link);

  if (!tokenHash) {
    throw new Error("Could not extract token hash from generate_link response");
  }

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
  if (!session?.access_token) {
    throw new Error("No access_token in verify response");
  }

  return session.access_token;
}

async function main() {
  const { email, json } = parseArgs(process.argv);
  if (!email || !email.includes("@")) {
    console.error(
      "Usage: node scripts/get-user-access-token.mjs <email> [--json]",
    );
    process.exit(1);
  }

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error(
      "Missing Supabase credentials. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.",
    );
    process.exit(1);
  }

  const accessToken = await generateUserToken(email);
  if (json) {
    const expiresAt = decodeJwtExpiryIso(accessToken);
    console.log(
      JSON.stringify(
        {
          email,
          accessToken,
          expiresAt,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Default output is token-only so callers can safely capture with command substitution.
  console.log(accessToken);
}

main().catch((error) => {
  console.error(`[token] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
