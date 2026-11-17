"use client";

// FDI numbering, drawn from the dentist's view: patient's right on the viewer's left.
const PERMANENT = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};
const PRIMARY = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerRight: [85, 84, 83, 82, 81],
  lowerLeft: [71, 72, 73, 74, 75],
};

export type Dentition = "permanent" | "primary";

export function ToothChart({
  selected,
  dentition,
  onToggle,
  small = false,
}: {
  selected: number[];
  dentition: Dentition;
  onToggle?: (tooth: number) => void;
  small?: boolean;
}) {
  const map = dentition === "primary" ? PRIMARY : PERMANENT;
  const readOnly = !onToggle;

  const tooth = (n: number, lower: boolean) => {
    const on = selected.includes(n);
    const cls = [
      "grid min-w-0 flex-1 basis-0 place-items-center border font-semibold",
      small ? "h-[30px] max-w-[34px] text-[10.5px]" : "h-11 max-w-11 text-[12.5px] max-sm:h-10 max-sm:text-[11px]",
      lower ? "rounded-t-[14px] rounded-b-[8px]" : "rounded-t-[8px] rounded-b-[14px]",
      on ? "border-brand bg-brand text-white" : "border-line-strong bg-white text-[#2a3b42]",
      readOnly ? "" : "cursor-pointer hover:border-brand",
    ].join(" ");
    return readOnly ? (
      <span key={n} className={cls}>
        {n}
      </span>
    ) : (
      <button
        key={n}
        type="button"
        className={cls}
        aria-pressed={on}
        aria-label={`שן ${n}`}
        onClick={() => onToggle(n)}
      >
        {n}
      </button>
    );
  };

  const quad = (teeth: number[], lower: boolean, side: "r" | "l") => (
    <div className={`flex min-w-0 flex-1 gap-[3px] ${side === "r" ? "justify-end" : "justify-start"}`}>
      {teeth.map((n) => tooth(n, lower))}
    </div>
  );

  return (
    <div
      dir="ltr"
      className={`mx-auto flex flex-col gap-1.5 ${small && dentition === "primary" ? "max-w-[420px]" : "max-w-[720px]"}`}
      role={readOnly ? "img" : "group"}
      aria-label={readOnly ? `שיניים מסומנות: ${selected.join(", ")}` : "תרשים לסתות, לחצו על שן לבחירה"}
    >
      <div className="flex justify-between text-[12px] text-muted" aria-hidden="true">
        <span>ימין המטופל</span>
        <span>שמאל המטופל</span>
      </div>
      <div className="flex items-stretch gap-1.5">
        {quad(map.upperRight, false, "r")}
        <div className="w-0.5 shrink-0 rounded bg-line-strong" />
        {quad(map.upperLeft, false, "l")}
      </div>
      <div className="h-0.5 rounded bg-line-strong" />
      <div className="flex items-stretch gap-1.5">
        {quad(map.lowerRight, true, "r")}
        <div className="w-0.5 shrink-0 rounded bg-line-strong" />
        {quad(map.lowerLeft, true, "l")}
      </div>
    </div>
  );
}
