"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useCanSettle } from "./useCanSettle";
import { useGetFinanceSetupQuery, type ChecklistKey } from "@/store/slices/finance";

const ITEMS: Record<ChecklistKey, { label: string; href: string }> = {
  branches: { label: "建立分部，設定負責人與過期收入對象", href: "/finance/settings#branches" },
  lessonBranches: { label: "每門進行中的課都標上分部", href: "/lessons" },
  teachers: { label: "每位老師設好付款人", href: "/finance/settings#teachers" },
  venues: { label: "建立場地，次數包補上剩幾次", href: "/finance/settings#venues" },
  rules: { label: "每門進行中的課設分帳規則", href: "/lessons" },
  funds: { label: "確認各分部公積金期初", href: "/finance/settings#branches" },
  legacyPrepaid: { label: "確認舊卡預收總額", href: "/finance/settings#legacy" },
};

/** 開帳清單：沒做完的項目一直顯示在 /finance 上方，做完整塊消失。 */
export default function SetupChecklist() {
  const { data } = useGetFinanceSetupQuery();
  const canEdit = useCanSettle();
  if (!data || data.complete) return null;
  const Wrapper = (canEdit ? Link : "div") as React.ElementType;
  const total = data.items.length;
  const done = data.items.filter((i) => i.done).length;

  return (
    <section aria-label="開帳清單" className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
      <h2 className="text-base font-semibold text-warning-950">
        開帳清單 {done}/{total}
      </h2>
      <ol className="mt-2 flex flex-col">
        {data.items.map((item, i) => {
          const meta = ITEMS[item.key];
          return (
            <li key={item.key}>
              <Wrapper
                {...(canEdit ? { href: meta.href } : {})}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 text-sm ${canEdit ? "hover:bg-warning-100" : ""}`}
              >
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    item.done ? "bg-primary-600 text-white" : "border-[1.5px] border-warning-600 text-warning-950"
                  }`}
                >
                  {item.done ? "✓" : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={item.done ? "text-neutral-500 line-through" : "font-medium text-neutral-900"}>
                    {meta.label}
                  </span>
                  {!item.done && item.detail && (
                    <span className="text-[13px] text-neutral-600">{item.detail}</span>
                  )}
                </span>
                {!item.done && canEdit && <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />}
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
