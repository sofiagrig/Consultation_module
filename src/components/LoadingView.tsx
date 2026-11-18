/** Shown instantly while a screen loads, so a click never looks ignored. */
export function LoadingView({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-[#3c4e56]">
        <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-brand-soft border-t-brand" aria-hidden="true" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap gap-4" aria-hidden="true">
        <div className="card h-64 min-w-0 flex-[1_1_300px] animate-pulse bg-[#f7f9fa]" />
        <div className="card h-64 min-w-0 flex-[999_1_480px] animate-pulse bg-[#f7f9fa]" />
      </div>
    </div>
  );
}
