import Link from "next/link";
import { notFound } from "next/navigation";
import { ToothChart } from "@/components/ToothChart";
import {
  canScreen,
  formatDate,
  getViewer,
  ROLE_LABEL,
  seesAll,
  SEX_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  userNames,
  type AuthorRole,
  type ConsultStatus,
} from "@/lib/consult";
import { MAX_FILES_PER_REQUEST } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { CloseButton, FileButton, ForwardPanel, ReplyBox } from "./RequestControls";

type Message = {
  id: number;
  author_id: string | null;
  author_role: AuthorRole;
  body: string;
  note_to_doctor: boolean;
  event: "forwarded" | "closed" | null;
  event_data: { doctor_id?: string; by?: AuthorRole };
  created_at: string;
};
type FileRow = { id: string; message_id: number | null; file_name: string; size_bytes: number };

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

  const [{ data: msgData }, { data: fileData }] = await Promise.all([
    supabase.from("consult_messages").select("*").eq("request_id", id).order("id"),
    supabase.from("consult_files").select("id, message_id, file_name, size_bytes").eq("request_id", id).order("created_at"),
  ]);
  const messages = (msgData ?? []) as Message[];
  const files = (fileData ?? []) as FileRow[];

  const status = req.status as ConsultStatus;
  const branchName = (req.branches as { name: string } | null)?.name ?? "";
  const specialty = req.specialties as { id: string; name: string };
  const names = await userNames([
    req.doctor_id,
    ...messages.map((m) => m.author_id),
    ...messages.map((m) => m.event_data?.doctor_id),
  ]);
  const doctorName = req.doctor_id ? names.get(req.doctor_id) || "רופא מומחה" : null;

  const isOpsTriage = canScreen(viewer.role) && !req.doctor_id && status !== "closed";
  let forward: { specialties: { id: string; name: string }[]; specialists: { user_id: string; full_name: string; specialty_ids: string[]; waiting_count: number }[] } | null = null;
  if (isOpsTriage) {
    const [{ data: specs }, { data: specialists }] = await Promise.all([
      supabase.from("specialties").select("id, name").order("sort_order"),
      supabase.rpc("consult_specialists"),
    ]);
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

  const myAuthorRole: AuthorRole | null =
    req.doctor_id === viewer.userId
      ? "doctor"
      : viewer.role === "ops" || viewer.role === "admin" || viewer.role === "clinic"
        ? viewer.role
        : null;
  const authorName = (m: Message) =>
    m.author_role === "doctor"
      ? names.get(m.author_id ?? "") || "רופא מומחה"
      : m.author_role === "ops"
        ? ROLE_LABEL.ops
        : m.author_role === "admin"
          ? `${names.get(m.author_id ?? "") || ""} · ${ROLE_LABEL.admin}`
          : branchName;
  const side = (role: AuthorRole) =>
    role === myAuthorRole
      ? "self-start border-[#cbe6e8] bg-brand-soft"
      : role === "ops" || role === "admin"
        ? "self-end border-[#e4d9fb] bg-[#f6f2ff]"
        : "self-end border-line bg-[#f7f9fa]";

  const replyLabel =
    myAuthorRole === "doctor"
      ? "תשובה למרפאה"
      : myAuthorRole === "ops" || myAuthorRole === "admin"
        ? req.doctor_id
          ? "הודעה בשרשור (המרפאה והרופא יראו אותה)"
          : "תשובה למרפאה, בלי להעביר למומחה"
        : doctorName
          ? `תגובה ל${doctorName}`
          : "תגובה לסמנכ״ל התפעול";

  const questionFiles = files.filter((f) => f.message_id === null);
  const hasPrimary = (req.teeth as number[]).some((t) => t >= 51);
  const hasPermanent = (req.teeth as number[]).some((t) => t < 51);

  return (
    <>
      <Link href="/" className="back-link">
        → חזרה לרשימה
      </Link>

      {sent && (
        <p role="status" className="mb-3 rounded-[10px] border border-[#cbe6e8] bg-brand-soft px-3 py-2.5 text-sm">
          הפנייה נשלחה לסמנכ״ל התפעול לבדיקה.
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
            <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {specialty.name} · {doctorName ?? STATUS_LABEL.triage} · {branchName} · נפתחה {formatDate(req.created_at)}
          </p>
        </div>
        {myAuthorRole && status !== "closed" && <CloseButton requestId={id} />}
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
            <Detail label="רופא מומחה" value={doctorName ?? "טרם הועבר"} />
            <Detail label="הועברה לרופא" value={req.forwarded_at ? formatDate(req.forwarded_at) : "—"} />
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
          <div className="flex flex-col gap-3 p-[18px]">
            <Bubble className={side("clinic")} who={`${branchName} · השאלה`} time={formatDate(req.created_at)} text={req.question}>
              <Files files={questionFiles} />
            </Bubble>
            {messages.map((m) =>
              m.author_role === "system" ? (
                <div key={m.id} className="self-center rounded-full bg-[#eef2f3] px-3 py-1 text-center text-[13px] text-[#4a5b62]">
                  {m.event === "forwarded"
                    ? `הפנייה הועברה ל${names.get(m.event_data.doctor_id ?? "") || "רופא מומחה"} על ידי ${m.event_data.by === "admin" ? names.get(m.author_id ?? "") || ROLE_LABEL.admin : ROLE_LABEL.ops}`
                    : `הפנייה נסגרה על ידי ${m.event_data.by === "clinic" ? branchName : m.event_data.by === "doctor" ? doctorName ?? "הרופא" : m.event_data.by === "admin" ? names.get(m.author_id ?? "") || ROLE_LABEL.admin : ROLE_LABEL.ops}`}{" "}
                  · {formatDate(m.created_at)}
                </div>
              ) : (
                <Bubble
                  key={m.id}
                  className={side(m.author_role)}
                  who={`${authorName(m)}${m.note_to_doctor ? " · הערה לרופא" : ""}`}
                  time={formatDate(m.created_at)}
                  text={m.body || "צורף קובץ"}
                >
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

          {myAuthorRole ? (
            <ReplyBox
              requestId={id}
              label={replyLabel}
              placeholder={myAuthorRole === "clinic" ? "תגובה, פרטים נוספים או שאלת המשך" : "תשובה או שאלת הבהרה למרפאה"}
              sendLabel={status === "closed" ? "שליחה ופתיחה מחדש" : (myAuthorRole === "ops" || myAuthorRole === "admin") && !req.doctor_id ? "שליחת תשובה למרפאה" : "שליחה"}
              filesLeft={MAX_FILES_PER_REQUEST - files.length}
            />
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
  time,
  text,
  children,
}: {
  className: string;
  who: string;
  time: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`max-w-[min(560px,94%)] rounded-[14px] border px-3.5 py-3 ${className}`}>
      <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-[#4a5b62]">
        <b>{who}</b>
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
        <FileButton key={f.id} id={f.id} name={f.file_name} size={f.size_bytes} />
      ))}
    </div>
  );
}
