import { cache } from "react";
import { displayUsername } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** The module role of the signed-in user. null = no access to the consultation module. */
export type ConsultRole = "clinic" | "ops" | "specialist" | "overview" | "admin";
export type ConsultStatus = "triage" | "waiting_doctor" | "answered" | "closed";
export type AuthorRole = "clinic" | "ops" | "admin" | "doctor" | "system";

export type Viewer = {
  userId: string;
  username: string;
  fullName: string;
  role: ConsultRole | null;
  branchId: string | null;
  branchName: string | null;
};

/**
 * Who is signed in and in which capacity. Roles come from the shared database:
 * consult_access (ops / admin / specialist / overview) wins; otherwise a clinic manager of a branch
 * (profiles.app_role = 'clinic_manager') is the clinic role. Permissions themselves are
 * enforced by RLS — this only decides which screens to show.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, app_role, branch_id, branches(name)")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("consult_access").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  const isClinic = profile?.app_role === "clinic_manager" && !!profile.branch_id;
  const role: ConsultRole | null =
    (access?.role as ConsultRole | undefined) ?? (isClinic ? "clinic" : null);
  const branch = profile?.branches as { name: string } | { name: string }[] | null | undefined;

  return {
    userId: user.id,
    username: displayUsername(user.email),
    fullName: profile?.full_name || displayUsername(user.email),
    role,
    branchId: isClinic ? profile!.branch_id : null,
    branchName: isClinic ? (Array.isArray(branch) ? branch[0]?.name : branch?.name) ?? null : null,
  };
});

export const ROLE_LABEL: Record<ConsultRole, string> = {
  clinic: "מנהל/ת מרפאה",
  ops: "סמנכ״ל תפעול",
  specialist: "רופא מומחה",
  overview: "הנהלה",
  admin: "מנהל מערכת",
};

/** Ops and the system admin screen requests: they answer, forward and close. */
export function canScreen(role: ConsultRole | null): boolean {
  return role === "ops" || role === "admin";
}

/** Roles that see every request and the access log. */
export function seesAll(role: ConsultRole | null): boolean {
  return role === "ops" || role === "admin" || role === "overview";
}

export const STATUS_LABEL: Record<ConsultStatus, string> = {
  triage: "בבדיקת סמנכ״ל תפעול",
  waiting_doctor: "ממתינה לרופא",
  answered: "נענתה",
  closed: "סגורה",
};

export const STATUS_CLASS: Record<ConsultStatus, string> = {
  triage: "bg-[#efe7ff] text-[#5b21b6]",
  waiting_doctor: "bg-[#fff1dc] text-[#7a4100]",
  answered: "bg-[#e3edff] text-[#1e40af]",
  closed: "bg-[#eceff1] text-[#46545a]",
};

export const SEX_LABEL: Record<string, string> = { male: "זכר", female: "נקבה" };

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Names of users by id (profiles are readable to every signed-in user). */
export async function userNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", unique);
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.full_name as string) || ""]));
}
