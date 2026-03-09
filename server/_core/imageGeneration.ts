/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function hslColor(seed: number, saturation: number, lightness: number): string {
  const hue = seed % 360;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function buildFallbackSvg(prompt: string): string {
  const seed = hashString(prompt || "locomotivate");
  const accentA = hslColor(seed, 78, 58);
  const accentB = hslColor(seed >> 3, 72, 48);
  const accentC = hslColor(seed >> 7, 68, 62);
  const glow = hslColor(seed >> 11, 85, 72);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1600" y2="900" gradientUnits="userSpaceOnUse">
      <stop stop-color="#070B18"/>
      <stop offset="1" stop-color="#10182C"/>
    </linearGradient>
    <radialGradient id="orbA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(360 240) rotate(35) scale(420 420)">
      <stop stop-color="${glow}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1240 700) rotate(12) scale(420 420)">
      <stop stop-color="${accentC}" stop-opacity="0.65"/>
      <stop offset="1" stop-color="${accentC}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="250" y1="150" x2="1380" y2="780" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0.03)"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect x="0" y="0" width="1600" height="900" fill="url(#orbA)"/>
  <rect x="0" y="0" width="1600" height="900" fill="url(#orbB)"/>
  <g opacity="0.95">
    <circle cx="1275" cy="190" r="140" fill="${accentA}" fill-opacity="0.22"/>
    <circle cx="250" cy="760" r="170" fill="${accentB}" fill-opacity="0.18"/>
    <rect x="240" y="140" width="1120" height="620" rx="42" fill="url(#panel)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="315" y="230" width="310" height="42" rx="21" fill="rgba(255,255,255,0.08)"/>
    <rect x="315" y="320" width="760" height="78" rx="24" fill="rgba(255,255,255,0.08)"/>
    <rect x="315" y="430" width="880" height="34" rx="17" fill="rgba(255,255,255,0.05)"/>
    <rect x="315" y="488" width="720" height="34" rx="17" fill="rgba(255,255,255,0.04)"/>
    <rect x="315" y="600" width="170" height="52" rx="26" fill="${accentA}" fill-opacity="0.24"/>
    <rect x="515" y="600" width="150" height="52" rx="26" fill="${accentB}" fill-opacity="0.2"/>
    <rect x="695" y="600" width="220" height="52" rx="26" fill="${accentC}" fill-opacity="0.18"/>
  </g>
</svg>`;
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    const fallbackSvg = buildFallbackSvg(options.prompt);
    const { url } = await storagePut(
      `generated/${Date.now()}.svg`,
      fallbackSvg,
      "image/svg+xml",
    );
    return { url };
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  return {
    url,
  };
}
