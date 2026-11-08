"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useCanSettle } from "./useCanSettle";
import { useGetFinanceSetupQuery } from "@/store/slices/finance";
import { SETUP_STEPS } from "./setup/steps";

/**
 * 開帳進度小卡（總覽、財務設定）：還沒開帳時顯示，點進 /finance/setup 精靈。開帳後就不見。
 * 不能結算的人只看得到進度，不能點。
 */
export default function SetupBanner() {
  const { data } = useGetFinanceSetupQuery();
  const canEdit = useCanSettle();
  if (!data || data.items.find((i) => i.key === "opening")?.done) return null;
  const total = data.items.length;
  const done = data.items.filter((i) => i.done).length;
  const next = data.items.find((i) => !i.done);

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold">還沒開帳：先把開帳設定做完</span>
          <span className="text-[13px] tabular-nums">
            {done} / {total}
            {next && canEdit && ` · 下一步：${SETUP_STEPS[next.key].short}`}
            {!canEdit && " · 由可以結算的人設定"}
          </span>
        </span>
        <span className="h-1.5 max-w-sm overflow-hidden rounded-full bg-warning-100">
          <span className="block h-full rounded-full bg-warning-600" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </span>
      </span>
      {canEdit && (
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
          繼續設定<ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </>
  );
  const cls = "flex items-center gap-4 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4 text-warning-950";
  return canEdit ? (
    <Link href="/finance/setup" className={`${cls} hover:border-warning-300`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
