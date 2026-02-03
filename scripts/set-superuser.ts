import "dotenv/config";
import { upsertUser } from "../server/db";

async function main() {
  const email = "jason@secretlab.com";
  console.log(`[Script] Upserting user with email: ${email}`);

  await upsertUser({
    openId: "jason_secretlab_coordinator",
    name: "Jason",
    email: email,
    loginMethod: "email",
    role: "coordinator" as const,
  });

  console.log(`[Script] User upserted successfully with 'coordinator' role!`);
  process.exit(0);
}

main().catch(err => {
  console.error("[Script] Error:", err);
  process.exit(1);
});
