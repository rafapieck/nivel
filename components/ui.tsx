// Small shared building blocks for forms and cards (large, readable, mobile-first).

export const card = "space-y-3 rounded-2xl bg-white p-4 shadow-sm";
export const primaryBtn =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-lg font-semibold text-white disabled:opacity-60";
export const secondaryBtn =
  "flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-slate-300 px-4 text-base font-semibold text-slate-700 disabled:opacity-60";
export const inputCls =
  "min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl aria-[invalid=true]:border-red-600";

export function Field({
  id,
  label,
  hint,
  error,
  unit,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  unit?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-lg font-semibold">
        {label}
      </label>
      {hint && <p className="text-base text-slate-600">{hint}</p>}
      <div className="flex items-center gap-2">
        {children}
        {unit && <span className="min-w-8 text-lg text-slate-600">{unit}</span>}
      </div>
      {error && <p className="text-base font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const cls = {
    info: "bg-blue-50 text-blue-900",
    error: "bg-red-50 text-red-900",
    ok: "bg-green-50 text-green-900",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-base ${cls}`}>
      {children}
    </p>
  );
}

/** Collects the first message per field from a Zod error. */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}
