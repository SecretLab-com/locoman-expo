import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = "testuser@bright.blue";
  const password = "supertest";
  const name = "Test Admin";
  const role = "coordinator"; // Coordinator can impersonate others
  
  // Generate password hash
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  
  // Generate unique openId for password-based user
  const openId = `pwd_testadmin_${Date.now()}`;
  
  console.log("Creating test admin user:");
  console.log("  Email:", email);
  console.log("  Password:", password);
  console.log("  Role:", role);
  console.log("  OpenId:", openId);
  console.log("  Password Hash:", passwordHash);
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Check if user already exists
    const [existing] = await connection.execute(
      "SELECT id, email, role FROM users WHERE email = ?",
      [email]
    );
    
    if (existing.length > 0) {
      console.log("\nUser already exists with ID:", existing[0].id);
      console.log("Updating password and role...");
      
      await connection.execute(
        "UPDATE users SET passwordHash = ?, role = ?, name = ? WHERE email = ?",
        [passwordHash, role, name, email]
      );
      
      console.log("User updated successfully!");
    } else {
      // Insert new user
      const [result] = await connection.execute(
        `INSERT INTO users (openId, email, name, passwordHash, loginMethod, role, active)
         VALUES (?, ?, ?, ?, 'password', ?, true)`,
        [openId, email, name, passwordHash, role]
      );
      
      console.log("\nUser created successfully with ID:", result.insertId);
    }
    
    // Verify the user
    const [user] = await connection.execute(
      "SELECT id, email, name, role, loginMethod FROM users WHERE email = ?",
      [email]
    );
    
    console.log("\nVerified user:", user[0]);
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
