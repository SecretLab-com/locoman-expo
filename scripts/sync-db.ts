import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  console.log("Connecting to", url.split("@").pop());
  const db = drizzle(url);

  console.log("Adding missing columns to users table...");
  try {
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS phone varchar(20),
      ADD COLUMN IF NOT EXISTS photoUrl text,
      ADD COLUMN IF NOT EXISTS username varchar(64) UNIQUE,
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS specialties json,
      ADD COLUMN IF NOT EXISTS socialLinks json,
      ADD COLUMN IF NOT EXISTS trainerId int,
      ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS metadata json,
      ADD COLUMN IF NOT EXISTS passwordHash varchar(255)
    `);

    console.log("Modifying role enum...");
    // MySQL 8.0/MariaDB Enum modification
    await db.execute(sql`
      ALTER TABLE users 
      MODIFY COLUMN role enum('shopper', 'client', 'trainer', 'manager', 'coordinator') DEFAULT 'shopper' NOT NULL
    `);

    console.log("Database synced successfully!");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

main();
