/**
 * Bundle Image Generation Service
 * Uses the server's built-in image generation capabilities
 */

export interface GenerateImageParams {
  bundleTitle: string;
  bundleDescription?: string;
  goals?: string[];
  style?: "modern" | "fitness" | "wellness" | "professional";
}

/**
 * Build a prompt for bundle cover image generation
 */
export function buildBundleImagePrompt(params: GenerateImageParams): string {
  const { bundleTitle, bundleDescription, goals = [], style = "fitness" } = params;

  const goalsText = goals.length > 0 ? `focusing on ${goals.join(", ")}` : "";
  
  const styleDescriptions: Record<string, string> = {
    modern: "clean, minimalist, modern design with geometric shapes and gradients",
    fitness: "energetic, dynamic fitness imagery with athletic elements",
    wellness: "calm, serene wellness imagery with natural elements and soft colors",
    professional: "professional, corporate style with clean lines and business aesthetics",
  };

  return `Create a professional fitness bundle cover image for "${bundleTitle}". ${
    bundleDescription ? `The bundle is about: ${bundleDescription}.` : ""
  } ${goalsText}. Style: ${styleDescriptions[style]}. The image should be suitable as a product thumbnail, with no text overlays, high quality, and visually appealing for a fitness/wellness mobile app.`;
}

/**
 * Build a prompt for trainer profile image generation
 */
export function buildTrainerProfileImagePrompt(params: {
  trainerName: string;
  specialties?: string[];
}): string {
  const { specialties = [] } = params;
  
  const specialtiesText = specialties.length > 0 
    ? `specializing in ${specialties.join(", ")}` 
    : "";

  return `Create a professional fitness trainer profile background image. ${specialtiesText}. The image should be abstract, modern, and suitable as a profile header for a fitness professional. Use energetic colors and dynamic shapes. No faces or text.`;
}

/**
 * Build a prompt for product promotional image generation
 */
export function buildProductImagePrompt(params: {
  productName: string;
  category?: string;
}): string {
  const { productName, category = "fitness" } = params;

  return `Create a professional product image for "${productName}" in the ${category} category. Clean white background, product photography style, high quality, suitable for e-commerce listing.`;
}
