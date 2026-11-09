"use client";

import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import type { Allocation } from "@/domains/finance/types";
import type { PeriodFinance } from "@/store/slices/finance";
import type { SplitNames } from "./useSplitNames";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const WARNING_TEXT = {
  NO_PACK: "這個場地還沒設定收費（每次多少或次數包），場地費先記 $0",
  PACK_OVERDRAWN: "次數包用完了，記得記新的一包",
} as const;

/** 同一個 payee 的幾筆合成一筆（固定＋剩下的可能都給同一個人）。 */
function sumByPayee(allocations: Allocation[], names: SplitNames) {
  const sums = new Map<string, number>();
  for (const a of allocations) {
    const label = names.payee(a.payee);
    sums.set(label, (sums.get(label) ?? 0) + a.amount);
  }
  return [...sums];
}

export default function PeriodSplitRow({
  period,
  names,
  studentName,
  canEdit,
  onOverride,
  onResetOverride,
}: {
  period: PeriodFinance;
  names: SplitNames;
  studentName: (id: number) => string;
  canEdit: boolean;
  onOverride: () => void;
  onResetOverride: () => void;
}) {
  const d = new Date(period.startTime);
  const realized = period.income.realized.reduce((sum, s) => sum + s.amount, 0);

  return (
    <li className="flex flex-col gap-1.5 border-b border-neutral-100 py-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-neutral-900">
          {d.getMonth() + 1}/{d.getDate()}（{WEEKDAYS[d.getDay()]}）
        </span>
        <span className="text-sm text-neutral-600">收入 {money(realized)}</span>
        {period.ruleSource === "override" && <StatusTag tone="outline">只改這堂</StatusTag>}
        <div className="ml-auto flex gap-1">
          {canEdit && period.ruleSource === "override" && (
            <Button variant="ghost" size="sm" onClick={onResetOverride}>
              還原
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onOverride}>
              只改這一堂
            </Button>
          )}
        </div>
      </div>

      {period.allocations ? (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-neutral-700">
          {sumByPayee(period.allocations, names).map(([label, amount]) => (
            <span key={label}>
              {label} <span className={amount < 0 ? "text-danger-700" : "font-medium"}>{money(amount)}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-neutral-500">還沒設分帳：這堂先全部算進分部，設好規則會自動重算</div>
      )}

      {period.income.pending.length > 0 && (
        <div className="flex flex-wrap gap-x-3 text-[13px] text-warning-950">
          {period.income.pending.map((p, i) => (
            <span key={i}>
              {p.kind === "unpaid" ? `待收 ${money(p.amount ?? 0)}` : "待定"} · {studentName(p.studentId)}
            </span>
          ))}
        </div>
      )}

      {period.warnings.map((w) => (
        <div key={w} className="text-[13px] text-warning-950">
          {WARNING_TEXT[w]}
        </div>
      ))}
    </li>
  );
}
