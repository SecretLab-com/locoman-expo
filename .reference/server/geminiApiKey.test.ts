/**
 * Test to validate the GEMINI_API_KEY is properly configured
 */

import { describe, it, expect } from "vitest";
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./_core/env";

describe("Gemini API Key Validation", () => {
  it("should have GEMINI_API_KEY configured", () => {
    expect(ENV.geminiApiKey).toBeTruthy();
    expect(ENV.geminiApiKey.length).toBeGreaterThan(10);
  });

  it("should be able to initialize Gemini client", () => {
    const client = new GoogleGenAI({ apiKey: ENV.geminiApiKey });
    expect(client).toBeDefined();
  });

  it("should be able to make a simple API call to validate the key", async () => {
    const client = new GoogleGenAI({ apiKey: ENV.geminiApiKey });
    
    // Make a simple text generation call to validate the API key
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: "Say 'hello' in one word" }] }],
    });
    
    expect(response).toBeDefined();
    expect(response.candidates).toBeDefined();
    expect(response.candidates?.length).toBeGreaterThan(0);
    
    // Check that we got a text response
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => 'text' in p);
    expect(textPart).toBeDefined();
  }, 30000); // 30 second timeout for API call
});
