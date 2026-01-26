import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcrypt";

// Test password hashing and verification
describe("Password Authentication", () => {
  const testPassword = "supertest";
  let hashedPassword: string;

  beforeAll(async () => {
    // Hash the test password
    hashedPassword = await bcrypt.hash(testPassword, 12);
  });

  describe("Password Hashing", () => {
    it("should hash a password", async () => {
      const hash = await bcrypt.hash("testpassword", 12);
      expect(hash).toBeDefined();
      expect(hash).not.toBe("testpassword");
      expect(hash.startsWith("$2b$")).toBe(true);
    });

    it("should generate different hashes for the same password", async () => {
      const hash1 = await bcrypt.hash("testpassword", 12);
      const hash2 = await bcrypt.hash("testpassword", 12);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Password Verification", () => {
    it("should verify correct password", async () => {
      const isValid = await bcrypt.compare(testPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const isValid = await bcrypt.compare("wrongpassword", hashedPassword);
      expect(isValid).toBe(false);
    });

    it("should reject empty password", async () => {
      const isValid = await bcrypt.compare("", hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe("Password Security", () => {
    it("should use bcrypt with cost factor 12", async () => {
      const hash = await bcrypt.hash("testpassword", 12);
      // bcrypt hash format: $2b$<cost>$<salt+hash>
      expect(hash).toMatch(/^\$2b\$12\$/);
    });

    it("should produce hash of correct length", async () => {
      const hash = await bcrypt.hash("testpassword", 12);
      // bcrypt hashes are always 60 characters
      expect(hash.length).toBe(60);
    });
  });
});

// Test the authentication flow
describe("Authentication Flow", () => {
  it("should validate email format", () => {
    const validEmails = [
      "test@example.com",
      "user.name@domain.org",
      "testuser@bright.blue",
    ];
    const invalidEmails = [
      "notanemail",
      "@nodomain.com",
      "no@",
      "",
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    validEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(true);
    });

    invalidEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it("should require non-empty password", () => {
    const validatePassword = (password: string) => password.length >= 1;
    
    expect(validatePassword("supertest")).toBe(true);
    expect(validatePassword("a")).toBe(true);
    expect(validatePassword("")).toBe(false);
  });
});
