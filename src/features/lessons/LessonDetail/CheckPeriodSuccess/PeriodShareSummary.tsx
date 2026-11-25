"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Lesson } from "@/store/slices/lessons";
import { formatMoney, formatShare } from "@/lib/money";
import { computeSplit, parseRevenueSplit } from "@/lib/revenueSplit";

export interface ShareRow {
  key: string;
  name: string;
  /** 怎麼付的：課卡名稱／單堂／整期／整期 · 請假。 */
  how: string;
  /** 這個人這堂算進收入的錢；null = 還沒處理（沒綁卡）。 */
  amount: number | null;
}

/**
 * 手機：這一堂的收入明細，排成一張截圖截得完的樣子——給夥伴對帳用
 * （2026-11-26 使用者要求：誰來上課、怎麼付、各算多少，加總之後怎麼分）。
 * 只有文字列：沒有頭像、按鈕、頁尾，一列 28px，二十個人也還在一個畫面裡。
 */
const PeriodShareSummary = ({
  lesson,
  when,
  rows,
  income,
  onClose,
}: {
  lesson: Lesson;
  when: string;
  rows: ShareRow[];
  income: number;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rule = parseRevenueSplit(lesson.revenueSplit);
  const split = rule && rule.steps.length > 0 ? computeSplit(income, rule) : null;
  const row = "flex h-7 items-baseline gap-2 text-sm";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="這堂收入明細"
      className="fixed inset-0 z-50 overflow-y-auto bg-white"
    >
      <div className="mx-auto flex w-full max-w-md flex-col px-5 pt-3 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1.5">
            <h2 className="truncate text-lg font-bold text-ink">{lesson.name}</h2>
            <p className="text-[13px] tabular-nums text-ink-3">{when}</p>
          </div>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <ul className="mt-3 border-t border-neutral-300 pt-2">
          {rows.map((r) => (
            <li key={r.key} className={row}>
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.name}</span>
              <span className="max-w-[45%] shrink-0 truncate text-[13px] text-ink-3">{r.how}</span>
              <span className="w-14 shrink-0 text-right tabular-nums text-ink">
                {r.amount === null ? "—" : formatShare(r.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-neutral-300 pt-2.5 font-bold text-ink">
          <span>這堂收入 · {rows.length} 人</span>
          <span className="text-lg tabular-nums">${formatMoney(income)}</span>
        </div>

        {split && (
          <div className="mt-4 border-t border-neutral-300 pt-2">
            {split.lines.map((l, i) => (
              <div key={i} className={row}>
                <span className="font-medium text-ink">{l.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{l.formula}</span>
                <b className="shrink-0 font-semibold tabular-nums text-ink">${formatMoney(l.amount)}</b>
              </div>
            ))}
            <div className={row}>
              <span className="flex-1 font-medium text-ink">剩下的 → {split.remainder.label}</span>
              <b
                className={`shrink-0 font-semibold tabular-nums ${
                  split.remainder.amount < 0 ? "text-danger-700" : "text-ink"
                }`}
              >
                ${formatMoney(split.remainder.amount)}
              </b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodShareSummary;
