import type { ReactNode } from "react";

/** A number with its label — the row of figures at the top of both teacher pages. */
const StatTile = ({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "default" | "warning";
}) => (
  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 flex flex-col gap-0.5">
    <span className="text-xs text-neutral-500">{label}</span>
    <span
      className={`text-2xl font-semibold tabular-nums ${
        tone === "warning" ? "text-warning-900" : "text-neutral-900"
      }`}
    >
      {value}
      {unit && <span className="ml-1 text-sm font-normal text-neutral-500">{unit}</span>}
    </span>
    {hint && <span className="text-xs text-neutral-500">{hint}</span>}
  </div>
);

export default StatTile;
