"use client";

import { createClient } from "@/lib/supabase/client";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/limits";

export function fileProblem(f: File): string | null {
  if (!ALLOWED_MIME.includes(f.type)) return `${f.name}: אפשר לצרף רק JPG, PNG או PDF`;
  if (f.size > MAX_FILE_BYTES) return `${f.name}: הקובץ גדול מ־100MB`;
  return null;
}

/**
 * Uploads files to the private bucket under "<request id>/<random>.<ext>" (storage keys stay
 * ASCII; the original name is kept in consult_files), then registers them on the request
 * (messageId null = the opening question). Storage and database rules check access.
 */
export async function uploadFiles(requestId: number, messageId: number | null, files: File[]) {
  if (files.length === 0) return;
  const supabase = createClient();
  const registered: { path: string; name: string; mime: string; size: number }[] = [];

  for (const f of files) {
    const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : "jpg";
    const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("consult-files")
      .upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error(`העלאת ${f.name} נכשלה: ${error.message}`);
    registered.push({ path, name: f.name, mime: f.type, size: f.size });
  }

  const { error } = await supabase.rpc("consult_add_files", {
    p_request_id: requestId,
    p_message_id: messageId,
    p_files: registered,
  });
  if (error) {
    throw new Error(error.message.includes("too_many_files") ? "עד 10 קבצים לפנייה" : `שמירת הקבצים נכשלה: ${error.message}`);
  }
}
