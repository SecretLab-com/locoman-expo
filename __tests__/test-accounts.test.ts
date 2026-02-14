import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Test Accounts and OAuth Fixes", () => {
  const projectRoot = path.resolve(__dirname, "..");

  describe("Test Accounts Configuration", () => {
    it("should not include deprecated trainer test account quick-fill", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");

      expect(content).not.toContain("trainer@secretlab.com");
      expect(content).not.toContain("test-account-trainer");
    });

    it("should not include deprecated client test account quick-fill", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");

      expect(content).not.toContain("client@secretlab.com");
      expect(content).not.toContain("test-account-client");
    });

    it("should not include deprecated manager test account quick-fill", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");

      expect(content).not.toContain("manager@secretlab.com");
      expect(content).not.toContain("test-account-manager");
    });

    it("should not include deprecated default shopper test account quick-fill", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");

      expect(content).not.toContain("testuser@secretlab.com");
      expect(content).not.toContain("test-account-shopper");
    });

    it("should rely on direct credentials entry instead of hardcoded test passwords", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");

      expect(content).toContain("signInWithPassword");
      expect(content).not.toContain("setPassword(\"supertest\")");
    });
  });

  describe("User Response includes Role", () => {
    it("should include role field in buildUserResponse", () => {
      const authUtilsPath = path.join(projectRoot, "server/_core/auth-utils.ts");
      const content = fs.readFileSync(authUtilsPath, "utf-8");
      
      expect(content).toContain("buildUserResponse");
      expect(content).toContain('role: user?.role ?? "shopper"');
    });
  });

  describe("OAuth Buttons Fix", () => {
    it("should use Supabase OAuth flow for Google sign in", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const helperPath = path.join(projectRoot, "lib/google-oauth.ts");
      const buttonContent = fs.readFileSync(oauthButtonsPath, "utf-8");
      const helperContent = fs.readFileSync(helperPath, "utf-8");
      
      expect(buttonContent).toContain("handleGoogleSignIn");
      expect(buttonContent).toContain("signInWithGoogle");
      expect(helperContent).toContain("supabase.auth.signInWithOAuth");
      expect(helperContent).toContain('provider: "google"');
    });

    it("should not use relative /api/auth/google URL", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const helperPath = path.join(projectRoot, "lib/google-oauth.ts");
      const buttonContent = fs.readFileSync(oauthButtonsPath, "utf-8");
      const helperContent = fs.readFileSync(helperPath, "utf-8");
      
      // Should not have the old relative URL that caused the routing error
      expect(buttonContent).not.toContain('"/api/auth/google"');
      expect(helperContent).not.toContain('"/api/auth/google"');
    });

    it("should use Supabase id token flow for Apple sign in", () => {
      const oauthButtonsPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      const content = fs.readFileSync(oauthButtonsPath, "utf-8");
      
      expect(content).toContain("handleAppleSignIn");
      expect(content).toContain("signInWithIdToken");
      expect(content).toContain('provider: "apple"');
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
