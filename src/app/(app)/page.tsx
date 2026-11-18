import Link from "next/link";
import {
  canScreen,
  formatDate,
  getViewer,
  SEX_LABEL,
  statusClass,
  statusLabel,
  userNames,
  type ConsultRole,
  type ConsultStatus,
} from "@/lib/consult";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: number;
  status: ConsultStatus;
  urgent: boolean;
  patient_name: string;
  patient_id_last4: string;
  patient_age: number;
  patient_sex: string;
  teeth: number[];
  created_at: string;
  last_message_at: string;
  last_message_by: string | null;
  last_clinic_message_at: string;
  last_clinic_message_by: string | null;
  doctor_id: string | null;
  branches: { name: string } | null;
  specialties: { name: string } | null;
};

type FilterKey = "all" | "open" | ConsultStatus;

/** The clinic does not see whether a specialist is involved: "in progress" covers both. */
function filtersFor(role: ConsultRole | null): { key: FilterKey; label: string }[] {
  if (role === "clinic") {
    return [
      { key: "all", label: "הכל" },
      { key: "open", label: "בטיפול" },
      { key: "answered", label: "נענתה" },
      { key: "closed", label: "סגורה" },
    ];
  }
  const keys: ConsultStatus[] =
    role === "specialist" ? ["waiting_doctor", "triage", "answered", "closed"] : ["triage", "waiting_doctor", "answered", "closed"];
  return [{ key: "all", label: "הכל" }, ...keys.map((k) => ({ key: k, label: statusLabel(role, k) }))];
}

const matches = (key: string, s: ConsultStatus) =>
  key === "all" || s === key || (key === "open" && (s === "triage" || s === "waiting_doctor"));

export default async function RequestsPage({ searchParams }: PageProps<"/">) {
  const viewer = (await getViewer())!;
  const { status } = await searchParams;
  const filters = filtersFor(viewer.role);
  const filter = filters.some((f) => f.key === status) ? (status as string) : "all";

  const supabase = await createClient();
  const [{ data }, { data: reads }] = await Promise.all([
    supabase
      .from("consult_requests")
      .select(
        "id, status, urgent, patient_name, patient_id_last4, patient_age, patient_sex, teeth, created_at, last_message_at, last_message_by, last_clinic_message_at, last_clinic_message_by, doctor_id, branches(name), specialties(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("consult_reads").select("request_id, seen_at"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const seen = new Map((reads ?? []).map((r) => [r.request_id as number, r.seen_at as string]));
  const doctors = await userNames(rows.map((r) => r.doctor_id));

  const counts: Record<string, number> = {};
  for (const f of filters) counts[f.key] = rows.filter((r) => matches(f.key, r.status)).length;

  // Ops and specialists work a queue: what needs them first, urgent first.
  const first: ConsultStatus | null =
    canScreen(viewer.role) ? "triage" : viewer.role === "specialist" ? "waiting_doctor" : null;
  const order: Record<ConsultStatus, number> = { triage: 1, waiting_doctor: 2, answered: 3, closed: 4 };
  const rank = (r: Row) => (r.status === first ? (r.urgent ? 0 : 1) : order[r.status] + 1);
  const shown = rows
    .filter((r) => matches(filter, r.status))
    .sort((a, b) => (first ? rank(a) - rank(b) : 0) || b.created_at.localeCompare(a.created_at));

  // The clinic only counts what reached it on the clinic channel.
  const isUnread = (r: Row) => {
    if (viewer.role === "overview" || viewer.role === "admin") return false;
    const [at, by] =
      viewer.role === "clinic" ? [r.last_clinic_message_at, r.last_clinic_message_by] : [r.last_message_at, r.last_message_by];
    return by !== viewer.userId && (!seen.has(r.id) || seen.get(r.id)! < at);
  };

  const title =
    viewer.role === "clinic" ? "הפניות שלנו" : viewer.role === "ops" ? "פניות לסינון" : viewer.role === "specialist" ? "תיבת פניות" : "כל הפניות";
  const sub =
    viewer.role === "clinic"
      ? `${viewer.branchName} · ${rows.length} פניות`
      : viewer.role === "ops"
        ? "כל הפניות מכל הסניפים · ממתינות לבדיקה ודחופות מופיעות ראשונות"
        : viewer.role === "specialist"
          ? "פניות שסמנכ״ל התפעול העביר אליך · דחופות וממתינות ראשונות"
          : viewer.role === "admin"
            ? "כל הפניות מכל הסניפים · ממתינות לבדיקה ודחופות מופיעות ראשונות"
            : "צפייה ומעקב";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{sub}</p>
        </div>
        {viewer.role === "clinic" && (
          <Link href="/requests/new" className="btn-primary">
            + פנייה חדשה
          </Link>
        )}
      </div>

      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="סינון לפי סטטוס">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/" : `/?status=${f.key}`}
            className={`chip ${filter === f.key ? "chip-on" : ""}`}
            aria-current={filter === f.key ? "page" : undefined}
          >
            {f.label} ({counts[f.key] ?? 0})
          </Link>
        ))}
      </nav>

      <ul className="mt-4 flex flex-col gap-2.5">
        {shown.map((r) => {
          const unread = isUnread(r);
          const doctor = r.doctor_id ? doctors.get(r.doctor_id) : null;
          return (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className={`card flex items-start gap-3 px-4 py-3.5 hover:border-brand ${unread ? "border-[#e9b796] bg-[#fffbf8]" : ""}`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b>
                      {viewer.role === "clinic"
                        ? `${r.specialties?.name}`
                        : `${r.branches?.name} · ${r.specialties?.name}${doctor && viewer.role !== "specialist" ? ` · ${doctor}` : ""}`}
                    </b>
                    {unread && <span className="pill bg-[#c2410c] text-white">{viewer.role === "clinic" ? "תשובה חדשה" : "חדש"}</span>}
                    {r.urgent && <span className="pill bg-[#fde7dc] text-[#9a3412]">דחוף</span>}
                    <span className={`pill ${statusClass(viewer.role, r.status)}`}>{statusLabel(viewer.role, r.status)}</span>
                  </span>
                  <span className="text-[13.5px] text-[#4a5b62]">
                    מס׳ {r.id} · {r.patient_name} · ת״ז …{r.patient_id_last4} · {SEX_LABEL[r.patient_sex]}, {r.patient_age} · שיניים{" "}
                    {r.teeth.join(", ")}
                  </span>
                </span>
                <span className="text-[12.5px] whitespace-nowrap text-muted">{formatDate(r.created_at)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <div className="mt-4 rounded-[14px] border border-dashed border-line-strong bg-white p-8 text-center text-muted">
          {rows.length === 0 ? "אין עדיין פניות" : "אין פניות בסטטוס הזה"}
        </div>
      )}
    </>
  );
}
