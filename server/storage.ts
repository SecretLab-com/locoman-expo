// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import fs from "fs/promises";
import path from "path";
import { getServerSupabase } from "../lib/supabase";
import { ENV } from "./_core/env";

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

function isForgeConfigured(): boolean {
  return !!ENV.forgeApiUrl && !!ENV.forgeApiKey;
}

function getSupabaseStorageBucket(): string {
  return (process.env.SUPABASE_STORAGE_BUCKET || "uploads").trim() || "uploads";
}

function isSupabaseStorageConfigured(): boolean {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(supabaseUrl && serviceRoleKey);
}

let ensuredSupabaseBucketName: string | null = null;

async function ensureSupabaseBucket(bucketName: string): Promise<void> {
  if (ensuredSupabaseBucketName === bucketName) {
    return;
  }

  const supabase = getServerSupabase();
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(bucketName);
  if (getBucketError && getBucketError.message.toLowerCase().includes("not found")) {
    const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024,
    });
    if (createBucketError && !createBucketError.message.toLowerCase().includes("already exists")) {
      throw createBucketError;
    }
  } else if (getBucketError) {
    throw getBucketError;
  } else if (existingBucket && !existingBucket.public) {
    const { error: updateBucketError } = await supabase.storage.updateBucket(bucketName, { public: true });
    if (updateBucketError) {
      throw updateBucketError;
    }
  }

  ensuredSupabaseBucketName = bucketName;
}

async function buildDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string,
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (!isForgeConfigured()) {
    if (isSupabaseStorageConfigured()) {
      await ensureSupabaseBucket(getSupabaseStorageBucket());
      const supabase = getServerSupabase();
      const bucketName = getSupabaseStorageBucket();

      let payload: Buffer;
      if (typeof data === "string") {
        if (data.includes(";base64,")) {
          payload = Buffer.from(data.split(";base64,").pop()!, "base64");
        } else {
          payload = Buffer.from(data, "utf-8");
        }
      } else {
        payload = Buffer.from(data);
      }

      const { error: uploadError } = await supabase.storage.from(bucketName).upload(key, payload, {
        contentType,
        upsert: true,
      });
      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(key);
      if (!publicUrlData?.publicUrl) {
        throw new Error(`Supabase storage upload succeeded but no public URL returned for ${key}`);
      }

      return { key, url: publicUrlData.publicUrl };
    }

    console.log(`[Storage] Forge not configured, using local fallback for ${key}`);
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, key);
    const fileDir = path.dirname(filePath);
    await fs.mkdir(fileDir, { recursive: true });

    let buffer: Buffer;
    if (typeof data === "string") {
      // Handle base64 or raw string
      if (data.includes(";base64,")) {
        buffer = Buffer.from(data.split(";base64,").pop()!, "base64");
      } else {
        buffer = Buffer.from(data, "utf-8");
      }
    } else {
      buffer = Buffer.from(data);
    }

    await fs.writeFile(filePath, buffer);
    return { key, url: `/uploads/${key}` };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`,
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (!isForgeConfigured()) {
    if (isSupabaseStorageConfigured()) {
      await ensureSupabaseBucket(getSupabaseStorageBucket());
      const supabase = getServerSupabase();
      const bucketName = getSupabaseStorageBucket();
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(key);
      if (publicUrlData?.publicUrl) {
        return {
          key,
          url: publicUrlData.publicUrl,
        };
      }
    }

    return {
      key,
      url: `/uploads/${key}`,
    };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
