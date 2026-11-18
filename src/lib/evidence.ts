import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "core-evidence";
export type EvidenceCategory = "invoices" | "conditions" | "manifests" | "claims" | "statements";

export async function prepareFile(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const { default: compress } = await import("browser-image-compression");
  return compress(file as File, { maxWidthOrHeight: 1200, maxSizeMB: 0.2, useWebWorker: true });
}

/** Uploads to `{shop_id}/{category}/{name}` and returns the relative object path. */
export async function uploadEvidence(shopId: string, category: EvidenceCategory, file: Blob, ext?: string) {
  const blob = await prepareFile(file);
  const e = ext ?? (blob.type === "application/pdf" ? "pdf" : blob.type.split("/")[1] ?? "bin");
  const path = `${shopId}/${category}/${crypto.randomUUID()}.${e}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export async function uploadAtPath(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return path;
}
