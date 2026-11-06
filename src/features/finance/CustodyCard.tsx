import InfoTip from "@/components/InfoTip";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CUSTODY_GROUP_LABELS, CUSTODY_GROUP_ORDER } from "./custodyRows";
import type { CustodyRow, CustodyTone } from "./custodyRows";

/** 負數用「−」標出來（不只靠顏色）。 */
export const formatSigned = (amount: number) =>
  Math.round(amount) < 0 ? `−$${formatMoney(Math.abs(amount))}` : `$${formatMoney(amount)}`;

const TONE_TEXT: Record<CustodyTone, string> = {
  locked: "text-neutral-500",
  owed: "text-neutral-900",
  mine: "text-neutral-900",
  fund: "text-neutral-900",
  pack: "text-neutral-900",
  peer: "text-neutral-900",
};

export interface CustodyCardProps {
  name: string;
  total: number;
  rows: CustodyRow[];
  /** 公積金為負、手上的錢又比預收少的分部（spec §14.6） */
  deficits: string[];
  /** 這個月這位保管人記過的轉帳（付清的待付列會消失，這裡留下痕跡）。 */
  transfers?: { key: string; text: string; amount: number }[];
}

/** 一位保管人的「保管中」表：總額在上，下面分四組（加起來等於總額）。 */
export default function CustodyCard({ name, total, rows, deficits, transfers = [] }: CustodyCardProps) {
  const groups = CUSTODY_GROUP_ORDER.map((g) => ({ group: g, rows: rows.filter((r) => r.group === g) })).filter(
    (g) => g.rows.length > 0,
  );
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-1 text-base font-semibold text-neutral-900">
          <span className="truncate">{name}保管中</span>
          <InfoTip label="保管中說明">
            系統算出這個人手上「應該」有多少教室的錢，各格加起來就是總額。錢實際放在哪裡不影響這張表。
          </InfoTip>
        </h2>
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            Math.round(total) < 0 ? "text-danger-700" : "text-neutral-900"
          )}
        >
          {formatSigned(total)}
        </span>
      </header>

      <div className="mt-3 flex flex-col gap-3">
        {groups.map(({ group, rows: groupRows }) => (
          <div key={group}>
            <h3 className="text-xs font-medium tracking-wide text-neutral-500">{CUSTODY_GROUP_LABELS[group]}</h3>
            <ul className="divide-y divide-neutral-100">
              {groupRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className={cn("min-w-0", TONE_TEXT[row.tone])}>
                    {row.label}
                    {row.tone === "locked" && (
                      <span className="block text-xs text-neutral-400">學生還沒上的課，要留著</span>
                    )}
                    {row.hint && <span className="block text-xs text-neutral-400">{row.hint}</span>}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      Math.round(row.amount) < 0 ? "text-danger-700" : "text-neutral-900"
                    )}
                  >
                    {formatSigned(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {deficits.map((text) => (
        <p key={text} className="mt-3 rounded-lg bg-warning-100 px-3 py-2 text-sm text-warning-950">
          {text}
        </p>
      ))}

      {transfers.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <h3 className="text-xs font-medium tracking-wide text-neutral-500">這個月已轉</h3>
          <ul>
            {transfers.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3 py-1.5 text-[13px] text-neutral-600">
                <span className="min-w-0">{t.text}</span>
                <span className="shrink-0 tabular-nums">${formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
