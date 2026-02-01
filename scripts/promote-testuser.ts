import "dotenv/config";

import { getUserByEmail, updateUserRole } from "../server/db";

const EMAIL = "testuser@secretlab.com";

async function run() {
  const user = await getUserByEmail(EMAIL);
  if (!user) {
    console.error(`[Promote] No user found for ${EMAIL}`);
    process.exit(1);
  }

  await updateUserRole(user.id, "coordinator");
  console.log(`[Promote] Updated ${EMAIL} to coordinator.`);
}

run().catch((error) => {
  console.error("[Promote] Failed:", error);
  process.exit(1);
});
