#!/usr/bin/env node
/**
 * Run a .sql file against the linked Supabase project using .env credentials.
 * Uses the Supabase pooler (same approach as `supabase/.temp/pooler-url`).
 *
 * Usage:
 *   node scripts/run-supabase-sql.mjs supabase/migrations/023_saved_cart_proposals.sql
 *
 * Requires in .env:
 *   SUPABASE_DATABASE_PASSWORD
 *
 * Requires file:
 *   supabase/.temp/project-ref  (from `supabase link`)
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
dotenv.config({ path: join(root, ".env") });

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/run-supabase-sql.mjs <path-to.sql>");
  process.exit(1);
}

const password = process.env.SUPABASE_DATABASE_PASSWORD;
if (!password) {
  console.error("Missing SUPABASE_DATABASE_PASSWORD in .env");
  process.exit(1);
}

let projectRef;
try {
  projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim();
} catch {
  console.error("Missing supabase/.temp/project-ref — run: supabase link");
  process.exit(1);
}

/** From supabase CLI after link (includes correct region). */
let poolerHost = "aws-0-us-west-2.pooler.supabase.com";
try {
  const poolerUrl = readFileSync(join(root, "supabase", ".temp", "pooler-url"), "utf8").trim();
  const host = new URL(
    poolerUrl.startsWith("postgresql:") ? poolerUrl : `postgresql://${poolerUrl}`,
  ).hostname;
  if (host) poolerHost = host;
} catch {
  /* use default */
}
const poolerUser = `postgres.${projectRef}`;

const resolvedSql = resolve(root, sqlFile);
const args = [
  "-h",
  poolerHost,
  "-p",
  "5432",
  "-U",
  poolerUser,
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  resolvedSql,
];

const result = spawnSync("psql", args, {
  stdio: "inherit",
  cwd: root,
  env: {
    ...process.env,
    PGPASSWORD: password,
    PGSSLMODE: "require",
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
