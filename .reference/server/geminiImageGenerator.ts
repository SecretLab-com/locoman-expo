/**
 * Gemini Image Generation Service
 * 
 * Uses Google's Gemini API (Nano Banana) to generate bundle cover images
 * by composing real product images into professional product photography.
 */

import { GoogleGenAI } from "@google/genai";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";

// ============================================================================
// TYPES
// ============================================================================

interface ProductImage {
  url: string;
  name: string;
}

interface GenerateBundleImageOptions {
  bundleId: number;
  title: string;
  products: ProductImage[];
  goalType?: string | null;
}

interface GenerateBundleImageResult {
  imageUrl: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

function getGeminiClient(): GoogleGenAI {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey: ENV.geminiApiKey });
}

// ============================================================================
// IMAGE FETCHING
// ============================================================================

/**
 * Fetch an image from URL and convert to base64
 */
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[GeminiImage] Failed to fetch image from ${url}: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    
    // Normalize mime type
    let mimeType = contentType.split(";")[0].trim();
    if (!mimeType.startsWith("image/")) {
      mimeType = "image/jpeg";
    }
    
    return { data: base64, mimeType };
  } catch (error) {
    console.error(`[GeminiImage] Error fetching image from ${url}:`, error);
    return null;
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build the prompt for Gemini image generation
 */
function buildPrompt(title: string, productNames: string[], goalType?: string | null): string {
  const productList = productNames.slice(0, 6).join(", ");
  
  // Base prompt for dramatic product photography with 3:1 aspect ratio
  let prompt = `Create a pixel-perfect product photography composition with a 3:1 aspect ratio (wide banner format, 3 times wider than tall) on a deep black background with dramatic studio lighting.`;
  
  // Add product context
  if (productList) {
    prompt += ` The image should feature these fitness products arranged elegantly: ${productList}.`;
  } else {
    prompt += ` The image should feature premium fitness supplements and equipment arranged elegantly.`;
  }
  
  // Style guidance based on goal type
  switch (goalType) {
    case "strength":
    case "power":
      prompt += ` Style: Bold, powerful composition with high contrast and dramatic shadows. Use warm accent lighting to suggest energy and power. The products should feel substantial and performance-oriented.`;
      break;
    case "weight_loss":
      prompt += ` Style: Clean, fresh composition with bright accents. Light, airy feel suggesting transformation and new beginnings. Use cool tones with energetic highlights.`;
      break;
    case "longevity":
      prompt += ` Style: Calm, balanced arrangement with soft natural lighting. Earthy tones and organic feel suggesting holistic health and wellness.`;
      break;
    default:
      prompt += ` Style: High-end commercial photography with soft shadows, rim lighting, and subtle reflections. Premium, aspirational, fitness-focused aesthetic.`;
  }
  
  // Composition guidance
  prompt += ` Composition: Clean, minimal layout with products as hero elements arranged horizontally across the wide 3:1 banner format. Use negative space effectively. Products should appear to float slightly above a reflective surface for a premium feel. The bundle is called "${title}".`;
  
  return prompt;
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate a bundle cover image using Gemini with real product images
 */
export async function generateBundleCoverWithGemini(
  options: GenerateBundleImageOptions
): Promise<GenerateBundleImageResult> {
  const { bundleId, title, products, goalType } = options;
  
  console.log(`[GeminiImage] Generating cover for bundle ${bundleId}: "${title}"`);
  console.log(`[GeminiImage] Products: ${products.map(p => p.name).join(", ")}`);
  
  try {
    const ai = getGeminiClient();
    
    // Build the text prompt
    const productNames = products.map(p => p.name);
    const textPrompt = buildPrompt(title, productNames, goalType);
    console.log(`[GeminiImage] Prompt: ${textPrompt.substring(0, 100)}...`);
    
    // Build content array with prompt and images
    const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: textPrompt }
    ];
    
    // Fetch and add product images (up to 6)
    const imagesToInclude = products.slice(0, 6);
    let imagesAdded = 0;
    
    for (const product of imagesToInclude) {
      if (product.url) {
        const imageData = await fetchImageAsBase64(product.url);
        if (imageData) {
          contents.push({
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          });
          imagesAdded++;
          console.log(`[GeminiImage] Added image for: ${product.name}`);
        }
      }
    }
    
    console.log(`[GeminiImage] Sending request with ${imagesAdded} product images`);
    
    // Generate the image using Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ role: "user", parts: contents }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });
    
    // Extract the generated image from response
    let generatedImageData: string | null = null;
    let generatedMimeType = "image/png";
    
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageData = part.inlineData.data;
          generatedMimeType = part.inlineData.mimeType ?? "image/png";
          break;
        }
      }
    }
    
    if (!generatedImageData) {
      console.error("[GeminiImage] No image generated in response");
      return {
        imageUrl: "",
        success: false,
        error: "No image generated in response",
      };
    }
    
    // Convert base64 to buffer and upload to S3
    const imageBuffer = Buffer.from(generatedImageData, "base64");
    const timestamp = Date.now();
    const extension = generatedMimeType.split("/")[1] || "png";
    const fileKey = `bundles/${bundleId}/cover-${timestamp}.${extension}`;
    
    const { url: imageUrl } = await storagePut(fileKey, imageBuffer, generatedMimeType);
    
    console.log(`[GeminiImage] Successfully generated and uploaded image: ${imageUrl}`);
    
    return {
      imageUrl,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[GeminiImage] Error generating image for bundle ${bundleId}:`, error);
    return {
      imageUrl: "",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if Gemini API is configured
 */
export function isGeminiConfigured(): boolean {
  return !!ENV.geminiApiKey;
}
