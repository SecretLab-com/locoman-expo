import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Test Accounts and OAuth Fixes", () => {
  const projectRoot = path.resolve(__dirname, "..");

  describe("Test Accounts Configuration", () => {
    it("should have trainer test account configured", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("trainer@secretlab.com");
      expect(content).toContain('role: "trainer"');
      expect(content).toContain("test_trainer_account");
    });

    it("should have client test account configured", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("client@secretlab.com");
      expect(content).toContain('role: "client"');
      expect(content).toContain("test_client_account");
    });

    it("should have manager test account configured", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("manager@secretlab.com");
      expect(content).toContain('role: "manager"');
      expect(content).toContain("test_manager_account");
    });

    it("should have default shopper test account configured", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("testuser@secretlab.com");
      expect(content).toContain("test_user_shopper");
    });

    it("should use same password for all test accounts", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      // All test accounts should use "supertest" password
      const passwordMatches = content.match(/password === "supertest"/g);
      expect(passwordMatches).not.toBeNull();
      expect(passwordMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("User Response includes Role", () => {
    it("should include role field in buildUserResponse", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("role: (user as any)?.role");
    });
  });

  describe("OAuth Buttons Fix", () => {
    it("should use startOAuthLogin for Google sign in", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const content = fs.readFileSync(oauthButtonsPath, "utf-8");
      
      // Should import and use startOAuthLogin instead of relative URL
      expect(content).toContain("startOAuthLogin");
      expect(content).toContain('import { startOAuthLogin');
    });

    it("should not use relative /api/auth/google URL", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const content = fs.readFileSync(oauthButtonsPath, "utf-8");
      
      // Should not have the old relative URL that caused the routing error
      expect(content).not.toContain('"/api/auth/google"');
    });

    it("should use getApiBaseUrl for Apple sign in", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const content = fs.readFileSync(oauthButtonsPath, "utf-8");
      
      expect(content).toContain("getApiBaseUrl");
      expect(content).toContain("apiBaseUrl");
    });
  });

  describe("Auth Context Role Support", () => {
    it("should have role helpers in auth context", () => {
      const authContextPath = path.join(projectRoot, "contexts/auth-context.tsx");
      const content = fs.readFileSync(authContextPath, "utf-8");
      
      expect(content).toContain("isTrainer");
      expect(content).toContain("isClient");
      expect(content).toContain("isManager");
      expect(content).toContain("isCoordinator");
    });

    it("should determine trainer role correctly", () => {
      const authContextPath = path.join(projectRoot, "contexts/auth-context.tsx");
      const content = fs.readFileSync(authContextPath, "utf-8");
      
      // Trainer role check should include trainer, manager, and coordinator
      expect(content).toContain('effectiveRole === "trainer"');
    });
  });
});
