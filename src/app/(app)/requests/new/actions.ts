"use server";

import { getViewer } from "@/lib/consult";
import { createClient } from "@/lib/supabase/server";

export type NewRequestInput = {
  specialtyId: string;
  patientName: string;
  patientIdLast4: string;
  patientAge: number;
  patientSex: "male" | "female";
  teeth: number[];
  question: string;
  urgent: boolean;
};

export async function createRequest(
  input: NewRequestInput,
): Promise<{ id: number } | { error: string }> {
  const viewer = await getViewer();
  if (viewer?.role !== "clinic") return { error: "רק מנהל/ת מרפאה יכול/ה לפתוח פנייה" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consult_create_request", {
    p_specialty_id: input.specialtyId,
    p_patient_name: input.patientName,
    p_patient_id_last4: input.patientIdLast4,
    p_patient_age: input.patientAge,
    p_patient_sex: input.patientSex,
    p_teeth: input.teeth,
    p_question: input.question,
    p_urgent: input.urgent,
  });

  if (error) {
    // The database is the source of truth for validation; map its errors to Hebrew.
    const m = error.message;
    if (m.includes("patient_id_last4")) return { error: "4 ספרות ת״ז לא תקינות" };
    if (m.includes("teeth")) return { error: "מספרי השיניים לא תקינים" };
    if (m.includes("patient_name")) return { error: "שם המטופל לא תקין" };
    if (m.includes("patient_age")) return { error: "הגיל לא תקין" };
    if (m.includes("not_allowed")) return { error: "אין הרשאה לפתוח פנייה" };
    return { error: "לא הצלחנו לשמור את הפנייה. נסו שוב." };
  }
  return { id: data as number };
}
