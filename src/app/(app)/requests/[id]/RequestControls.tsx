"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatSize, MAX_FILES_PER_REQUEST } from "@/lib/limits";
import { fileProblem, uploadFiles } from "@/lib/upload";
import { closeRequest, fileLink, forwardRequest, postMessage, type Channel } from "./actions";

export function FileButton({ id, name, size, kindLabel }: { id: string; name: string; size: number; kindLabel?: string }) {
  const [error, setError] = useState("");
  const open = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const tab = window.open("", "_blank");
    const res = await fileLink(id);
    if ("url" in res) {
      if (tab) tab.location.href = res.url;
      else window.location.href = res.url;
    } else {
      tab?.close();
      setError(res.error);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" className="file-chip min-h-11 cursor-pointer hover:border-brand" onClick={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        {kindLabel && <b className="text-[12.5px]">{kindLabel}:</b>}
        {name} <small className="text-muted">{formatSize(size)}</small>
      </button>
      {error && <small className="text-[#8f1d1d]">{error}</small>}
    </span>
  );
}

export function CloseButton({ requestId, prominent = false }: { requestId: number; prominent?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = async () => {
    setBusy(true);
    const res = await closeRequest(requestId);
    setBusy(false);
    if (res) setError(res.error);
  };

  if (!prominent) {
    return (
      <button type="button" className="btn-secondary" disabled={busy} onClick={close}>
        סגירת הפנייה
      </button>
    );
  }
  return (
    <div className="mx-[18px] mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-brand bg-brand-soft px-4 py-3.5">
      <div>
        <b className="block">קיבלתם מענה?</b>
        <span className="text-sm text-[#3c4e56]">אם אין שאלות נוספות, סגרו את הפנייה. אפשר לפתוח אותה שוב בהודעה חדשה.</span>
        {error && <span className="block text-sm text-[#8f1d1d]">{error}</span>}
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={close}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {busy ? "סוגרים…" : "קיבלתי מענה, סגירת הפנייה"}
      </button>
    </div>
  );
}

export type ReplyOption = { channel: Channel; tab: string; label: string; placeholder: string; sendLabel: string };

/**
 * Reply box. With more than one option (ops/admin) a toggle picks the channel: to the
 * clinic, or internal to the specialist.
 */
export function ReplyBox({
  requestId,
  options,
  filesLeft,
}: {
  requestId: number;
  options: ReplyOption[];
  filesLeft: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const opt = options[index];
  const internal = opt.channel === "internal";

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const problems = picked.map(fileProblem).filter(Boolean) as string[];
    const ok = picked.filter((f) => !fileProblem(f));
    const room = filesLeft - files.length;
    if (ok.length > room) problems.push(`עד ${MAX_FILES_PER_REQUEST} קבצים לפנייה`);
    setFiles((f) => [...f, ...ok.slice(0, Math.max(0, room))]);
    setError(problems.join(" · "));
  };

  const send = async () => {
    if (!body.trim() && files.length === 0) {
      setError("כתבו הודעה או צרפו קובץ");
      return;
    }
    setBusy(true);
    setError("");
    let res: Awaited<ReturnType<typeof postMessage>>;
    try {
      res = await postMessage(requestId, body.trim(), files.length > 0, opt.channel);
    } catch (e) {
      setError(`השליחה נכשלה (${(e as Error).message || "שגיאת שרת"}). נסו שוב.`);
      setBusy(false);
      return;
    }
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    try {
      await uploadFiles(requestId, res.id, files.map((file) => ({ file, kind: "other" as const })));
    } catch (e) {
      setError((e as Error).message);
    }
    setBody("");
    setFiles([]);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className={`flex flex-col gap-2.5 border-t px-[18px] pt-3.5 pb-[18px] ${internal ? "border-[#e4d9fb] bg-[#fcfaff]" : "border-line"}`}>
      {options.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="למי לכתוב">
          {options.map((o, i) => (
            <button
              key={o.channel}
              type="button"
              className={`chip ${i === index ? "chip-on" : ""}`}
              aria-pressed={i === index}
              onClick={() => {
                setIndex(i);
                setError("");
              }}
            >
              {o.tab}
            </button>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="label">{opt.label}</span>
        <textarea
          className="input min-h-[92px] resize-y"
          rows={3}
          placeholder={opt.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="file-chip">
              {f.name} <small className="text-muted">{formatSize(f.size)}</small>
              <button type="button" className="icon-btn" aria-label={`הסרת ${f.name}`} onClick={() => setFiles((a) => a.filter((_, j) => j !== i))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {filesLeft > 0 ? (
          <label className="btn-secondary relative">
            צירוף קובץ
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              className="absolute h-px w-px opacity-0"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <span className="text-[13px] text-muted">הגעתם ל־10 קבצים בפנייה</span>
        )}
        <button type="button" className="btn-primary" onClick={send} disabled={busy}>
          {busy ? "שולחים…" : opt.sendLabel}
        </button>
      </div>
    </div>
  );
}

type Specialist = { user_id: string; full_name: string; specialty_ids: string[]; waiting_count: number };

export function ForwardPanel({
  requestId,
  requestedSpecialty,
  specialties,
  specialists,
}: {
  requestId: number;
  requestedSpecialty: { id: string; name: string };
  specialties: { id: string; name: string }[];
  specialists: Specialist[];
}) {
  const [specialty, setSpecialty] = useState<string>(requestedSpecialty.id);
  const [doctor, setDoctor] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Specialists without a linked staff record have no specialties: show them under "all".
  const shown = specialists.filter((s) => specialty === "all" || s.specialty_ids.includes(specialty));
  const chosen = specialists.find((s) => s.user_id === doctor);

  const submit = async () => {
    if (!doctor) {
      setError("בחרו רופא מומחה");
      return;
    }
    setBusy(true);
    const res = await forwardRequest(requestId, doctor, note.trim());
    setBusy(false);
    if (res) setError(res.error);
  };

  return (
    <section className="card mt-4 border-[#d8c8f7] bg-[#fcfaff] p-[18px]" aria-label="העברה לרופא מומחה">
      <h2 className="mb-1 text-base font-semibold">העברה לרופא מומחה</h2>
      <p className="mb-4 text-sm text-[#3c4e56]">
        אם אפשר לענות בלי מומחה, כתבו תשובה למרפאה בשרשור למטה. אם צריך חוות דעת מומחה, בחרו רופא והעבירו.
      </p>
      <span className="label mb-1.5 block">תחום · המרפאה ביקשה {requestedSpecialty.name}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="תחום הרופא">
        {[...specialties, { id: "all", name: "כל הרופאים" }].map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${specialty === s.id ? "chip-on" : ""}`}
            aria-pressed={specialty === s.id}
            onClick={() => {
              setSpecialty(s.id);
              setDoctor("");
              setError("");
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <span className="label mt-4 mb-1.5 block">רופא מומחה</span>
      {shown.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2" role="group" aria-label="רופא מומחה">
          {shown.map((s) => (
            <button
              key={s.user_id}
              type="button"
              aria-pressed={doctor === s.user_id}
              onClick={() => {
                setDoctor(s.user_id);
                setError("");
              }}
              className={`flex min-h-[58px] cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-right hover:border-brand ${
                doctor === s.user_id ? "border-brand bg-[#f1fafa] shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line-strong"
              }`}
            >
              <span>
                <b>{s.full_name || "ללא שם"}</b>
                <small className="block text-[12.5px] text-muted">
                  {s.waiting_count ? `${s.waiting_count} ממתינות לו` : "אין פניות ממתינות"}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          אין רופא מומחה מוגדר בתחום הזה. אפשר לבחור &quot;כל הרופאים&quot;, או להגדיר רופא כמומחה במסד הנתונים.
        </p>
      )}

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="label">הערה לרופא (לא חובה)</span>
        <textarea
          className="input min-h-[72px] resize-y"
          rows={2}
          placeholder="למשל: על מה חשוב לשים דגש"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="alert-error mt-2.5">
          {error}
        </p>
      )}
      <div className="mt-3.5">
        <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "מעבירים…" : chosen ? `העברה ל${chosen.full_name}` : "העברה לרופא"}
        </button>
      </div>
    </section>
  );
}
