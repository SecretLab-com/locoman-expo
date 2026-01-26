/**
 * Bundle Cover Image Generator
 * 
 * Automatically generates professional cover images for bundles using AI.
 * Uses product images as reference to create cohesive, dramatic compositions.
 */

import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import * as db from "./db";
import { generateBundleCoverWithGemini, isGeminiConfigured } from "./geminiImageGenerator";

// ============================================================================
// TYPES
// ============================================================================

interface ProductInfo {
  name: string;
  imageUrl?: string | null;
  category?: string | null;
}

interface GenerateBundleImageOptions {
  bundleId: number;
  title: string;
  products: ProductInfo[];
  goalType?: string | null;
  forceRegenerate?: boolean;
}

interface GenerateBundleImageResult {
  imageUrl: string;
  thumbnailUrl?: string;
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * Build the image generation prompt based on bundle contents
 */
function buildImagePrompt(
  title: string,
  products: ProductInfo[],
  goalType?: string | null
): string {
  // Extract product names for the prompt
  const productNames = products
    .map((p) => p.name)
    .filter(Boolean)
    .slice(0, 6) // Limit to 6 products for cleaner composition
    .join(", ");

  // Base prompt for dramatic product photography with 3:1 aspect ratio
  const basePrompt = `Create a pixel-perfect product photography composition with a 3:1 aspect ratio (wide banner format, 3 times wider than tall) on a deep black background with dramatic studio lighting.`;

  // Product-specific section
  const productSection = productNames
    ? `Arrange these fitness products elegantly: ${productNames}.`
    : `Arrange premium fitness supplements and equipment elegantly.`;

  // Style guidance based on goal type
  let styleGuidance = "";
  switch (goalType) {
    case "strength":
    case "power":
      styleGuidance = `Style: Bold, powerful composition with high contrast and dramatic shadows. Products should feel substantial and performance-oriented. Use warm accent lighting to suggest energy and power.`;
      break;
    case "weight_loss":
      styleGuidance = `Style: Clean, fresh composition with bright accents. Light, airy feel suggesting transformation. Use cool tones with energetic highlights.`;
      break;
    case "longevity":
      styleGuidance = `Style: Calm, balanced arrangement with soft natural lighting. Earthy tones and organic feel suggesting holistic health and wellness.`;
      break;
    default:
      styleGuidance = `Style: High-end commercial photography with soft shadows, rim lighting, and subtle reflections. Premium, aspirational, fitness-focused aesthetic.`;
  }

  // Composition guidance
  const compositionGuidance = `Composition: Clean, minimal layout with products as hero elements arranged horizontally across the wide 3:1 banner format. Use negative space effectively. Products should appear to float slightly above a reflective surface for a premium feel.`;

  return `${basePrompt} ${productSection} ${styleGuidance} ${compositionGuidance}`;
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate a cover image for a bundle
 */
export async function generateBundleCoverImage(
  options: GenerateBundleImageOptions
): Promise<GenerateBundleImageResult> {
  const { bundleId, title, products, goalType } = options;

  console.log(`[BundleImage] Generating cover for bundle ${bundleId}: "${title}"`);

  try {
    // Check if Gemini is configured - prefer it for real product image composition
    if (isGeminiConfigured()) {
      console.log(`[BundleImage] Using Gemini API for image generation`);
      
      // Prepare product images for Gemini
      const productImages = products
        .filter((p) => p.imageUrl)
        .slice(0, 6)
        .map((p) => ({
          url: p.imageUrl!,
          name: p.name,
        }));
      
      const geminiResult = await generateBundleCoverWithGemini({
        bundleId,
        title,
        products: productImages,
        goalType,
      });
      
      if (geminiResult.success && geminiResult.imageUrl) {
        // Update the bundle draft with the new image URL
        await db.updateBundleDraft(bundleId, {
          imageUrl: geminiResult.imageUrl,
        });
        
        console.log(`[BundleImage] Updated bundle ${bundleId} with Gemini-generated image`);
        
        return {
          imageUrl: geminiResult.imageUrl,
        };
      } else {
        console.warn(`[BundleImage] Gemini generation failed: ${geminiResult.error}, falling back to default`);
      }
    }
    
    // Fallback to built-in image generation
    console.log(`[BundleImage] Using built-in image generation`);
    
    // Build the prompt
    const prompt = buildImagePrompt(title, products, goalType);
    console.log(`[BundleImage] Prompt: ${prompt.substring(0, 100)}...`);

    // Collect product images as references (if available)
    const originalImages: Array<{ url: string; mimeType: string }> = [];
    
    for (const product of products.slice(0, 4)) {
      if (product.imageUrl) {
        originalImages.push({
          url: product.imageUrl,
          mimeType: "image/jpeg",
        });
      }
    }

    // Generate the image
    const result = await generateImage({
      prompt,
      originalImages: originalImages.length > 0 ? originalImages : undefined,
    });

    if (!result.url) {
      throw new Error("Image generation returned no URL");
    }

    console.log(`[BundleImage] Generated image: ${result.url}`);

    // Store with bundle-specific path
    const timestamp = Date.now();
    const imageKey = `bundles/${bundleId}/cover-${timestamp}.png`;
    
    // The generateImage function already saves to S3, but we want a specific path
    // For now, use the returned URL directly
    const imageUrl = result.url;

    // Update the bundle draft with the new image URL
    await db.updateBundleDraft(bundleId, {
      imageUrl,
    });

    console.log(`[BundleImage] Updated bundle ${bundleId} with image URL`);

    return {
      imageUrl,
    };
  } catch (error) {
    console.error(`[BundleImage] Error generating image for bundle ${bundleId}:`, error);
    throw error;
  }
}

/**
 * Check if bundle needs image regeneration based on product changes
 */
export function shouldRegenerateImage(
  oldProducts: ProductInfo[] | null | undefined,
  newProducts: ProductInfo[] | null | undefined
): boolean {
  // Always generate if no existing products
  if (!oldProducts || oldProducts.length === 0) return true;
  if (!newProducts || newProducts.length === 0) return false;

  // Compare product names
  const oldNames = new Set(oldProducts.map((p) => p.name).filter(Boolean));
  const newNames = new Set(newProducts.map((p) => p.name).filter(Boolean));

  // Check if sets are different
  if (oldNames.size !== newNames.size) return true;
  
  for (const name of Array.from(oldNames)) {
    if (!newNames.has(name)) return true;
  }

  return false;
}

/**
 * Extract product info from bundle's productsJson
 */
export function extractProductsFromBundle(
  productsJson: unknown
): ProductInfo[] {
  if (!productsJson) return [];
  
  try {
    const products = Array.isArray(productsJson) ? productsJson : [];
    return products.map((p: any) => ({
      name: p.name || p.title || "Product",
      imageUrl: p.imageUrl || p.image_url || p.image,
      category: p.category || p.type,
    }));
  } catch {
    return [];
  }
}

/**
 * Generate image for a bundle by ID
 */
export async function generateImageForBundle(
  bundleId: number
): Promise<GenerateBundleImageResult | null> {
  const draft = await db.getBundleDraftById(bundleId);
  if (!draft) {
    console.error(`[BundleImage] Bundle ${bundleId} not found`);
    return null;
  }

  // Get template for goal type if available
  let goalType: string | null = null;
  if (draft.templateId) {
    const template = await db.getBundleTemplateById(draft.templateId);
    goalType = template?.goalType || null;
  }

  const products = extractProductsFromBundle(draft.productsJson);

  return generateBundleCoverImage({
    bundleId,
    title: draft.title,
    products,
    goalType,
  });
}
