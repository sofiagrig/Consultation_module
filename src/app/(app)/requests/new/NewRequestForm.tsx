"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ToothChart, type Dentition } from "@/components/ToothChart";
import { formatSize, MAX_FILES_PER_REQUEST } from "@/lib/limits";
import { fileProblem, uploadFiles, type UploadKind } from "@/lib/upload";
import { createRequest } from "./actions";

type Specialty = { id: string; name: string; code: string };

export function NewRequestForm({ specialties }: { specialties: Specialty[] }) {
  const router = useRouter();
  const [specialtyId, setSpecialtyId] = useState("");
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"" | "male" | "female">("");
  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [teeth, setTeeth] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<{ file: File; kind: UploadKind }[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleTooth = (n: number) =>
    setTeeth((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n].sort((a, b) => a - b)));

  const addFiles = (list: FileList | null, kind: UploadKind) => {
    const picked = Array.from(list ?? []);
    const problems = picked.map(fileProblem).filter(Boolean) as string[];
    const ok = picked.filter((f) => !fileProblem(f));
    const room = MAX_FILES_PER_REQUEST - files.length;
    if (ok.length > room) problems.push(`עד ${MAX_FILES_PER_REQUEST} קבצים לפנייה`);
    setFiles((f) => [...f, ...ok.slice(0, Math.max(0, room)).map((file) => ({ file, kind }))]);
    setError(problems.join(" · "));
  };

  const fileField = (kind: UploadKind, title: string, hint: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="label">{title} (לא חובה)</span>
      <div className="flex flex-wrap gap-2">
        <label className="btn-secondary relative">
          + {title}
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            className="absolute h-px w-px opacity-0"
            onChange={(e) => {
              addFiles(e.target.files, kind);
              e.target.value = "";
            }}
          />
        </label>
        {files.map(({ file: f, kind: k }, i) =>
          k !== kind ? null : (
            <span key={`${f.name}-${i}`} className="file-chip">
              {f.name} <small className="text-muted">{formatSize(f.size)}</small>
              <button
                type="button"
                className="icon-btn"
                aria-label={`הסרת ${f.name}`}
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </span>
          ),
        )}
      </div>
      <span className="text-[13px] text-muted">{hint}</span>
    </div>
  );

  const submit = async () => {
    const missing: string[] = [];
    if (!specialtyId) missing.push("תחום ההתייעצות");
    if (name.trim().length < 2) missing.push("שם המטופל");
    if (!/^\d{4}$/.test(last4)) missing.push("4 ספרות אחרונות של ת״ז");
    if (!age || Number(age) > 120) missing.push("גיל");
    if (!sex) missing.push("מין");
    if (teeth.length === 0) missing.push("שן אחת לפחות");
    if (!question.trim()) missing.push("השאלה");
    if (missing.length) {
      setError(`חסר למילוי: ${missing.join(", ")}`);
      return;
    }

    setBusy(true);
    setError("");
    let res: Awaited<ReturnType<typeof createRequest>>;
    try {
      res = await createRequest({
        specialtyId,
        patientName: name.trim(),
        patientIdLast4: last4,
        patientAge: Number(age),
        patientSex: sex as "male" | "female",
        teeth,
        question: question.trim(),
        urgent,
      });
    } catch (e) {
      console.error("createRequest failed", e);
      setError(`שמירת הפנייה נכשלה (${(e as Error).message || "שגיאת שרת"}). נסו שוב.`);
      setBusy(false);
      return;
    }
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    try {
      await uploadFiles(res.id, null, files);
    } catch (e) {
      console.error("uploadFiles failed", e);
      // The request exists; send the user to it and say which files did not make it.
      router.push(`/requests/${res.id}?upload_error=${encodeURIComponent((e as Error).message)}`);
      return;
    }
    router.push(`/requests/${res.id}?sent=1`);
  };

  return (
    <>
      <Link href="/" className="back-link">
        → חזרה לפניות
      </Link>
      <h1 className="text-2xl font-bold">פנייה חדשה</h1>

      <div className="mt-4 flex flex-col gap-4">
        <section className="card p-[18px]">
          <h2 className="mb-3 text-base font-semibold">1. תחום ההתייעצות</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="תחום ההתייעצות">
            {specialties.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${specialtyId === s.id ? "chip-on" : ""}`}
                aria-pressed={specialtyId === s.id}
                onClick={() => setSpecialtyId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-[18px]">
          <h2 className="mb-3 text-base font-semibold">2. פרטי המטופל</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] items-end gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="label">שם המטופל</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם פרטי ומשפחה" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">4 ספרות אחרונות של ת״ז</span>
              <input
                className="input tracking-[.08em] tabular-nums"
                dir="ltr"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">גיל</span>
              <input
                className="input"
                inputMode="numeric"
                maxLength={3}
                placeholder="לדוגמה 42"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="label">מין</span>
              <div className="flex gap-1.5" role="group" aria-label="מין">
                {(["male", "female"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip min-h-11 px-[18px] ${sex === v ? "chip-on" : ""}`}
                    aria-pressed={sex === v}
                    onClick={() => setSex(v)}
                  >
                    {v === "male" ? "זכר" : "נקבה"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card p-[18px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">3. מספרי שיניים</h2>
            <div className="flex gap-1.5" role="group" aria-label="סוג שיניים">
              {(["permanent", "primary"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${dentition === d ? "chip-on" : ""}`}
                  aria-pressed={dentition === d}
                  onClick={() => setDentition(d)}
                >
                  {d === "permanent" ? "שיניים קבועות" : "שיני חלב"}
                </button>
              ))}
            </div>
          </div>
          <ToothChart selected={teeth} dentition={dentition} onToggle={toggleTooth} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-sm">
            <span>{teeth.length ? `נבחרו: ${teeth.join(", ")}` : "לחצו על השיניים הרלוונטיות בתרשים"}</span>
            {teeth.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => setTeeth([])}>
                ניקוי בחירה
              </button>
            )}
          </div>
        </section>

        <section className="card p-[18px]">
          <h2 className="mb-3 text-base font-semibold">4. השאלה, צילומים ושאלון בריאות</h2>
          <label className="flex flex-col gap-1.5">
            <span className="label">השאלה</span>
            <textarea
              className="input min-h-[120px] resize-y"
              rows={5}
              placeholder="מה רואים, מה כבר נעשה, ועל מה רוצים חוות דעת"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {fileField("xray", "צילומים", "רנטגן, פנורמי, CT או תמונה קלינית")}
            {fileField("health", "שאלון בריאות", "סריקה או PDF של שאלון הבריאות של המטופל")}
          </div>
          <p className="mt-3 text-[13px] text-muted">JPG, PNG או PDF · עד 100MB לקובץ · עד 10 קבצים לפנייה</p>
        </section>

        <section className="card p-[18px]">
          <h2 className="mb-3 text-base font-semibold">5. דחיפות</h2>
          <div className="flex gap-1.5" role="group" aria-label="דחיפות">
            {[false, true].map((u) => (
              <button
                key={String(u)}
                type="button"
                className={`chip min-h-11 px-[22px] ${urgent === u ? "chip-on" : ""}`}
                aria-pressed={urgent === u}
                onClick={() => setUrgent(u)}
              >
                {u ? "דחוף" : "רגיל"}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
        <div className="flex gap-2.5">
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "שולחים…" : "שליחת הפנייה"}
          </button>
          <Link href="/" className="btn-secondary">
            ביטול
          </Link>
        </div>
      </div>
    </>
  );
}
