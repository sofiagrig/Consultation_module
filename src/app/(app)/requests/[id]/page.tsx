import Link from "next/link";
import { notFound } from "next/navigation";
import { ToothChart } from "@/components/ToothChart";
import {
  canScreen,
  consultSpecialties,
  FILE_KIND_LABEL,
  formatDate,
  getViewer,
  ROLE_LABEL,
  seesAll,
  SEX_LABEL,
  statusClass,
  statusLabel,
  TEAM_LABEL,
  userNames,
  type AuthorRole,
  type ConsultStatus,
  type FileKind,
} from "@/lib/consult";
import { MAX_FILES_PER_REQUEST } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { CloseButton, FileButton, ForwardPanel, ReplyBox, type ReplyOption } from "./RequestControls";

type Message = {
  id: number;
  author_id: string | null;
  author_role: AuthorRole;
  body: string;
  note_to_doctor: boolean;
  channel: "clinic" | "internal";
  event: "forwarded" | "closed" | null;
  event_data: { doctor_id?: string; by?: AuthorRole };
  created_at: string;
};
type FileRow = { id: string; message_id: number | null; file_name: string; size_bytes: number; kind: FileKind };

export default async function RequestPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const viewer = (await getViewer())!;
  const { id: idParam } = await params;
  const { sent, upload_error: uploadError } = await searchParams;
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) notFound();

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("consult_requests")
    .select("*, branches(name), specialties(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!req) notFound();

  // Marks the request read and writes the access log (also refuses if not allowed).
  await supabase.rpc("consult_open", { p_request_id: id });

  // RLS returns only what this user may see: the clinic gets the clinic channel only.
  const [{ data: msgData }, { data: fileData }] = await Promise.all([
    supabase.from("consult_messages").select("*").eq("request_id", id).order("id"),
    supabase.from("consult_files").select("id, message_id, file_name, size_bytes, kind").eq("request_id", id).order("created_at"),
  ]);
  const messages = (msgData ?? []) as Message[];
  const files = (fileData ?? []) as FileRow[];

  const isClinic = viewer.role === "clinic";
  const isDoctor = !!req.doctor_id && req.doctor_id === viewer.userId;
  const isScreener = canScreen(viewer.role);
  const status = req.status as ConsultStatus;
  const branchName = (req.branches as { name: string } | null)?.name ?? "";
  const specialty = req.specialties as { id: string; name: string };
  const names = await userNames([
    req.doctor_id,
    ...messages.map((m) => m.author_id),
    ...messages.map((m) => m.event_data?.doctor_id),
  ]);
  const doctorName = req.doctor_id ? names.get(req.doctor_id) || "רופא מומחה" : null;

  let forward: { specialties: { id: string; name: string }[]; specialists: { user_id: string; full_name: string; specialty_ids: string[]; waiting_count: number }[] } | null = null;
  if (isScreener && !req.doctor_id && status !== "closed") {
    const [specs, { data: specialists }] = await Promise.all([consultSpecialties(), supabase.rpc("consult_specialists")]);
    forward = { specialties: specs ?? [], specialists: specialists ?? [] };
  }

  let viewLog: { user_id: string | null; action: string; file_id: string | null; at: string }[] = [];
  if (seesAll(viewer.role)) {
    const { data } = await supabase
      .from("consult_view_log")
      .select("user_id, action, file_id, at")
      .eq("request_id", id)
      .order("at", { ascending: false })
      .limit(50);
    viewLog = data ?? [];
  }
  const logNames = await userNames(viewLog.map((v) => v.user_id));
  const fileName = new Map(files.map((f) => [f.id, f.file_name]));

  // The clinic sees the whole team as one voice: no names, no specialist.
  const authorName = (m: Message) => {
    if (m.author_role === "clinic") return branchName;
    if (isClinic) return TEAM_LABEL;
    if (m.author_role === "doctor") return names.get(m.author_id ?? "") || "רופא מומחה";
    if (m.author_role === "admin") return `${names.get(m.author_id ?? "") || ""} · ${ROLE_LABEL.admin}`;
    return ROLE_LABEL.ops;
  };
  const mine = (m: Message) => m.author_id === viewer.userId;
  const bubbleClass = (m: Message) =>
    mine(m)
      ? "self-start border-[#cbe6e8] bg-brand-soft"
      : m.channel === "internal"
        ? "self-end border-[#e4d9fb] bg-[#f6f2ff]"
        : "self-end border-line bg-[#f7f9fa]";
  const tag = (m: Message) =>
    isClinic ? "" : m.note_to_doctor ? "הערה לרופא · פנימי" : m.channel === "internal" ? "פנימי" : "למרפאה";

  const systemText = (m: Message) => {
    if (m.event === "forwarded") {
      const by = m.event_data.by === "admin" ? names.get(m.author_id ?? "") || ROLE_LABEL.admin : ROLE_LABEL.ops;
      return `הפנייה הועברה ל${names.get(m.event_data.doctor_id ?? "") || "רופא מומחה"} על ידי ${by}`;
    }
    if (isClinic) return "הפנייה נסגרה";
    const by = m.event_data.by;
    return `הפנייה נסגרה על ידי ${by === "clinic" ? branchName : by === "doctor" ? doctorName ?? "הרופא" : by === "admin" ? names.get(m.author_id ?? "") || ROLE_LABEL.admin : ROLE_LABEL.ops}`;
  };

  // Reply options per role. The database enforces the channel either way.
  let replyOptions: ReplyOption[] = [];
  if (isClinic) {
    replyOptions = [
      {
        channel: "clinic",
        tab: "",
        label: `הודעה ל${TEAM_LABEL}`,
        placeholder: "שאלת המשך, פרטים נוספים או צילום נוסף",
        sendLabel: status === "closed" ? "שליחה ופתיחה מחדש" : "שליחה",
      },
    ];
  } else if (isDoctor) {
    replyOptions = [
      {
        channel: "internal",
        tab: "",
        label: "תשובה לסמנכ״ל התפעול (המרפאה לא רואה אותה)",
        placeholder: "חוות הדעת שלך, או שאלת הבהרה",
        sendLabel: "שליחה לסמנכ״ל",
      },
    ];
  } else if (isScreener) {
    const toClinic: ReplyOption = {
      channel: "clinic",
      tab: "תשובה למרפאה",
      label: `תשובה למרפאה (תופיע בחתימת "${TEAM_LABEL}")`,
      placeholder: "השורה התחתונה למרפאה",
      sendLabel: status === "closed" ? "שליחה ופתיחה מחדש" : "שליחה למרפאה",
    };
    const internal: ReplyOption = {
      channel: "internal",
      tab: req.doctor_id ? `לרופא (${doctorName})` : "הערה פנימית",
      label: req.doctor_id ? `הודעה ל${doctorName} (המרפאה לא רואה אותה)` : "הערה פנימית (המרפאה לא רואה אותה)",
      placeholder: req.doctor_id ? "שאלה או בקשה לרופא" : "הערה לעצמך או למנהל המערכת",
      sendLabel: req.doctor_id ? "שליחה לרופא" : "שמירת הערה",
    };
    // After the specialist answered, the natural next step is the bottom line to the clinic;
    // while waiting on the specialist, writing to them.
    replyOptions = status === "waiting_doctor" ? [internal, toClinic] : [toClinic, internal];
  }

  const questionFiles = files.filter((f) => f.message_id === null);
  const hasPrimary = (req.teeth as number[]).some((t) => t >= 51);
  const hasPermanent = (req.teeth as number[]).some((t) => t < 51);
  const canClose = (isClinic || isScreener) && status !== "closed";

  return (
    <>
      <Link href="/" className="back-link">
        → חזרה לרשימה
      </Link>

      {sent && (
        <p role="status" className="mb-3 rounded-[10px] border border-[#cbe6e8] bg-brand-soft px-3 py-2.5 text-sm">
          הפנייה נשלחה ל{TEAM_LABEL}.
        </p>
      )}
      {uploadError && (
        <p role="alert" className="alert-error mb-3">
          הפנייה נשמרה, אבל חלק מהקבצים לא עלו: {String(uploadError)}. אפשר לצרף אותם שוב בהודעה למטה.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">פנייה מס׳ {req.id}</h1>
            {req.urgent && <span className="pill bg-[#fde7dc] text-[#9a3412]">דחוף</span>}
            <span className={`pill ${statusClass(viewer.role, status)}`}>{statusLabel(viewer.role, status)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {specialty.name}
            {!isClinic && ` · ${doctorName ?? "טרם הועבר לרופא"}`} · {branchName} · נפתחה {formatDate(req.created_at)}
          </p>
        </div>
        {canClose && <CloseButton requestId={id} />}
      </div>

      {forward && (
        <ForwardPanel
          requestId={id}
          requestedSpecialty={specialty}
          specialties={forward.specialties}
          specialists={forward.specialists}
        />
      )}

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <aside className="card min-w-0 flex-[1_1_300px] p-[18px]">
          <h2 className="mb-2.5 text-[15px] font-semibold">פרטי הפנייה</h2>
          <dl className="mb-5 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
            <Detail label="שם המטופל" value={req.patient_name} wide />
            <Detail label="4 ספרות ת״ז" value={<span dir="ltr" className="tracking-[.08em] tabular-nums">{req.patient_id_last4}</span>} />
            <Detail label="גיל · מין" value={`${req.patient_age} · ${SEX_LABEL[req.patient_sex]}`} />
            <Detail label="סניף שולח" value={branchName} />
            <Detail label="תחום" value={specialty.name} />
            {!isClinic && <Detail label="רופא מומחה" value={doctorName ?? "טרם הועבר"} />}
            {!isClinic && <Detail label="הועברה לרופא" value={req.forwarded_at ? formatDate(req.forwarded_at) : "—"} />}
          </dl>
          <h2 className="mb-2.5 text-[15px] font-semibold">שיניים מסומנות: {(req.teeth as number[]).join(", ")}</h2>
          <div className="flex flex-col gap-3">
            {(hasPermanent || !hasPrimary) && <ToothChart selected={req.teeth} dentition="permanent" small />}
            {hasPrimary && <ToothChart selected={req.teeth} dentition="primary" small />}
          </div>

          {viewLog.length > 0 && (
            <>
              <h2 className="mt-6 mb-2.5 text-[15px] font-semibold">יומן צפיות</h2>
              <ul className="flex flex-col gap-2 text-[13.5px]">
                {viewLog.map((v, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-2 gap-y-1 border-b border-[#eef2f3] pb-1.5">
                    <b>{logNames.get(v.user_id ?? "") || "משתמש"}</b>
                    <span className="text-muted">
                      {v.action === "file" ? `צפייה בקובץ ${fileName.get(v.file_id ?? "") ?? ""}` : "פתיחת הפנייה"} · {formatDate(v.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="card flex min-w-0 flex-[999_1_480px] flex-col" aria-label="שרשור ההתכתבות">
          {!isClinic && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line px-[18px] py-2.5 text-[12.5px] text-muted">
              <span>
                <span className="me-1 inline-block h-2.5 w-2.5 rounded-sm border border-line bg-[#f7f9fa] align-middle" /> המרפאה רואה
              </span>
              <span>
                <span className="me-1 inline-block h-2.5 w-2.5 rounded-sm border border-[#e4d9fb] bg-[#f6f2ff] align-middle" /> פנימי, המרפאה לא רואה
              </span>
            </div>
          )}
          <div className="flex flex-col gap-3 p-[18px]">
            <Bubble className={isClinic ? "self-start border-[#cbe6e8] bg-brand-soft" : "self-end border-line bg-[#f7f9fa]"} who={`${branchName} · השאלה`} time={formatDate(req.created_at)} text={req.question}>
              <Files files={questionFiles} />
            </Bubble>
            {messages.map((m) =>
              m.author_role === "system" ? (
                <div key={m.id} className="self-center rounded-full bg-[#eef2f3] px-3 py-1 text-center text-[13px] text-[#4a5b62]">
                  {systemText(m)} · {formatDate(m.created_at)}
                </div>
              ) : (
                <Bubble key={m.id} className={bubbleClass(m)} who={authorName(m)} tag={tag(m)} time={formatDate(m.created_at)} text={m.body || "צורף קובץ"}>
                  <Files files={files.filter((f) => f.message_id === m.id)} />
                </Bubble>
              ),
            )}
          </div>

          {status === "closed" && (
            <div className="mx-[18px] mb-3.5 rounded-[10px] bg-[#eef2f3] px-3 py-2.5 text-sm text-[#3c4e56]">
              הפנייה סגורה. הודעה חדשה תפתח אותה מחדש.
            </div>
          )}
          {isClinic && status === "answered" && <CloseButton requestId={id} prominent />}

          {replyOptions.length > 0 ? (
            <ReplyBox requestId={id} options={replyOptions} filesLeft={MAX_FILES_PER_REQUEST - files.length} />
          ) : (
            <div className="border-t border-line px-[18px] py-3.5 text-sm text-muted">
              צפייה ומעקב בלבד. ההתכתבות מתנהלת בין המרפאה, סמנכ״ל התפעול והרופא.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Bubble({
  className,
  who,
  tag,
  time,
  text,
  children,
}: {
  className: string;
  who: string;
  tag?: string;
  time: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`max-w-[min(560px,94%)] rounded-[14px] border px-3.5 py-3 ${className}`}>
      <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-[#4a5b62]">
        <span>
          <b>{who}</b>
          {tag && <span className="ms-2 text-[12px] text-muted">{tag}</span>}
        </span>
        <span>{time}</span>
      </div>
      <p className="whitespace-pre-line">{text}</p>
      {children}
    </div>
  );
}

function Files({ files }: { files: FileRow[] }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f) => (
        <FileButton key={f.id} id={f.id} name={f.file_name} size={f.size_bytes} kindLabel={FILE_KIND_LABEL[f.kind] || undefined} />
      ))}
    </div>
  );
}
