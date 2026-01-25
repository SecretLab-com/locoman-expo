import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Login Button and Test User Credentials", () => {
  const projectRoot = path.resolve(__dirname, "..");

  describe("Landing Page Login Button", () => {
    it("should have login button in the landing page for unauthenticated users", () => {
      const indexPath = path.join(projectRoot, "app/(tabs)/index.tsx");
      const content = fs.readFileSync(indexPath, "utf-8");
      
      // Check for login button that shows when not authenticated
      expect(content).toContain("!isAuthenticated");
      expect(content).toContain("Login");
      expect(content).toContain('onPress={handleLoginPress}');
    });

    it("should navigate to /login when login button is pressed", () => {
      const indexPath = path.join(projectRoot, "app/(tabs)/index.tsx");
      const content = fs.readFileSync(indexPath, "utf-8");
      
      // Check for login navigation
      expect(content).toContain('router.push("/login")');
    });

    it("should use useAuth hook to check authentication status", () => {
      const indexPath = path.join(projectRoot, "app/(tabs)/index.tsx");
      const content = fs.readFileSync(indexPath, "utf-8");
      
      expect(content).toContain("useAuth");
      expect(content).toContain("isAuthenticated");
    });
  });

  describe("Login Screen", () => {
    it("should have email and password input fields", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("email");
      expect(content).toContain("password");
      expect(content).toContain("TextInput");
    });

    it("should call /api/auth/login endpoint", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("/api/auth/login");
    });

    it("should have Sign In button", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("Sign In");
      expect(content).toContain("handleLogin");
    });
  });

  describe("Test User Credentials", () => {
    it("should have test user credentials configured in server", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      // Check for test user email
      expect(content).toContain("testuser@secretlab.com");
      // Check for test user password
      expect(content).toContain("supertest");
    });

    it("should create session for test user on successful login", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      // Check that test user gets a session
      expect(content).toContain("createSessionToken");
      expect(content).toContain("Test User");
    });

    it("should return success response for test user", () => {
      const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
      const content = fs.readFileSync(oauthPath, "utf-8");
      
      expect(content).toContain("success: true");
      expect(content).toContain("buildUserResponse");
    });
  });

  describe("Authentication Flow", () => {
    it("should have OAuth buttons on login screen", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("OAuthButtons");
    });

    it("should have guest browsing option", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("Browse as guest");
      expect(content).toContain("handleGuestPress");
    });

    it("should have register link", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("Sign Up");
      expect(content).toContain("handleRegisterPress");
    });
  });
});
