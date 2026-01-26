/**
 * Test script to verify Gemini image generation is working
 * Run with: node scripts/test-gemini-image.mjs
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set");
  process.exit(1);
}

async function testGeminiImageGeneration() {
  console.log("Testing Gemini image generation...");
  console.log("API Key (first 10 chars):", GEMINI_API_KEY.substring(0, 10) + "...");
  
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    const prompt = `Create a pixel-perfect product photography composition on a deep black background with dramatic studio lighting. Arrange premium fitness supplements and equipment elegantly. Style: High-end commercial photography with soft shadows, rim lighting, and subtle reflections. Premium, aspirational, fitness-focused aesthetic.`;
    
    console.log("\nSending request to Gemini...");
    console.log("Prompt:", prompt.substring(0, 100) + "...");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
    
    console.log("\nResponse received!");
    console.log("Candidates:", response.candidates?.length || 0);
    
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log("\nText response:", part.text.substring(0, 200));
        }
        if (part.inlineData) {
          console.log("\nImage generated!");
          console.log("MIME type:", part.inlineData.mimeType);
          console.log("Data length:", part.inlineData.data?.length || 0, "characters");
          
          // Save the image to verify
          if (part.inlineData.data) {
            const fs = await import("fs");
            const buffer = Buffer.from(part.inlineData.data, "base64");
            fs.writeFileSync("/tmp/gemini-test-image.png", buffer);
            console.log("Image saved to /tmp/gemini-test-image.png");
          }
        }
      }
    } else {
      console.log("No candidates in response");
      console.log("Full response:", JSON.stringify(response, null, 2).substring(0, 500));
    }
    
    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("Response:", error.response);
    }
    process.exit(1);
  }
}

testGeminiImageGeneration();
