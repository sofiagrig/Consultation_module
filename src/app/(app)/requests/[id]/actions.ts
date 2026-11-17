"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function hebrewError(message: string): string {
  if (message.includes("not_allowed")) return "אין הרשאה לפעולה הזו";
  if (message.includes("empty_message")) return "כתבו הודעה או צרפו קובץ";
  if (message.includes("not_a_specialist")) return "הרופא שנבחר לא מוגדר כרופא מומחה";
  if (message.includes("request_closed")) return "הפנייה סגורה";
  return "הפעולה נכשלה. נסו שוב.";
}

export async function postMessage(
  requestId: number,
  body: string,
  withFiles: boolean,
): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consult_post_message", {
    p_request_id: requestId,
    p_body: body,
    p_with_files: withFiles,
  });
  if (error) return { error: hebrewError(error.message) };
  revalidatePath(`/requests/${requestId}`);
  return { id: data as number };
}

export async function forwardRequest(
  requestId: number,
  doctorId: string,
  note: string,
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("consult_forward", {
    p_request_id: requestId,
    p_doctor_id: doctorId,
    p_note: note || null,
  });
  if (error) return { error: hebrewError(error.message) };
  revalidatePath(`/requests/${requestId}`);
  return null;
}

export async function closeRequest(requestId: number): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("consult_close", { p_request_id: requestId });
  if (error) return { error: hebrewError(error.message) };
  revalidatePath(`/requests/${requestId}`);
  return null;
}

/** Logs the view, then returns a 5-minute link to the private file. */
export async function fileLink(fileId: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { error: logError } = await supabase.rpc("consult_log_file_view", { p_file_id: fileId });
  if (logError) return { error: hebrewError(logError.message) };

  const { data: file } = await supabase.from("consult_files").select("storage_path").eq("id", fileId).single();
  if (!file) return { error: "הקובץ לא נמצא" };
  const { data, error } = await supabase.storage.from("consult-files").createSignedUrl(file.storage_path, 300);
  if (error || !data) return { error: "לא הצלחנו לפתוח את הקובץ" };
  return { url: data.signedUrl };
}
