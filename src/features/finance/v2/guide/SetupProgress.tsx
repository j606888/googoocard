"use client";

// 教學裡的「你的教室做到哪了」：讀開帳清單（GET /finance/setup）即時打勾，不另開 API。
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceEnabled } from "@/features/nav/useFinanceEnabled";
import { useGetFinanceSetupQuery } from "@/store/slices/finance";
import { SETUP_STEPS, setupStepHref } from "../../setup/steps";

export default function SetupProgress() {
  const enabled = useFinanceEnabled();
  const { data, isLoading } = useGetFinanceSetupQuery(undefined, { skip: enabled !== true });

  if (enabled === undefined) return <Skeleton className="h-48 rounded-2xl" />;
  if (!enabled) {
    return (
      <Box>
        <span className="text-sm text-neutral-600">
          這間教室還沒開財務。由教室擁有者到 <Link href="/finance" className="font-semibold text-primary-800">財務</Link> 按「開啟財務」，這裡就會出現你的進度。
        </span>
      </Box>
    );
  }
  if (isLoading || !data) return <Skeleton className="h-48 rounded-2xl" />;

  const done = data.items.filter((i) => i.done).length;
  return (
    <Box>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">你的教室做到哪了</span>
        <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-neutral-700">
          {done} / {data.items.length}
        </span>
      </div>
      {data.complete && <p className="text-sm text-primary-900">第一次設定和開帳都完成了，可以直接看「日常」那一段。</p>}
      <ol className="flex flex-col">
        {data.items.map((item, i) => {
          const meta = SETUP_STEPS[item.key];
          return (
            <li key={item.key}>
              <Link href={setupStepHref(item.key)} className="flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-neutral-50">
                {item.done ? (
                  <span aria-label="完成" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-100 text-primary-900">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span aria-label="還沒做" className="grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-warning-500 text-xs font-bold text-warning-950">
                    {i + 1}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={item.done ? "text-neutral-500" : "font-medium text-neutral-900"}>{meta.title}</span>
                  {!item.done && item.detail && <span className="text-[13px] text-neutral-600">{item.detail}</span>}
                </span>
                {!item.done && <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ol>
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5">{children}</div>;
}
