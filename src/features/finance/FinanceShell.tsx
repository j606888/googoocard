"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import SegmentedTabs from "@/components/SegmentedTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetFinanceSettingQuery } from "@/store/slices/finance";
import NotBuilt from "./setup/NotBuilt";
import { financeHref } from "./routes";

type Tab = "home" | "ledger" | "calendar" | "verify" | "teachers" | "mine" | "vault" | "rules" | "settings";

/**
 * 水庫每一頁的外框：標題、分頁。還沒建城時整個換成建城任務（或施工中），
 * 哪一頁都一樣；建城頁本身不帶分頁。
 */
export default function FinanceShell({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGetFinanceSettingQuery();
  const { data: me } = useGetMeQuery();
  const pathname = usePathname();
  const router = useRouter();

  const ready = Boolean(data?.setting?.setupCompletedAt);
  const building = pathname === financeHref.build;
  const tabs: { value: Tab; label: string; href: string }[] = [
    { value: "home", label: "小鎮", href: financeHref.home },
    { value: "ledger", label: "帳本", href: financeHref.ledger },
    { value: "calendar", label: "行事曆", href: financeHref.calendar },
    { value: "verify", label: "驗收", href: financeHref.verify },
    { value: "teachers", label: "老師薪水", href: financeHref.teachers },
    ...(me && !data?.isRevenueOwner ? [{ value: "mine" as const, label: "我的背包", href: financeHref.holder(me.id) }] : []),
    { value: "vault", label: "大水庫", href: financeHref.vault },
    { value: "rules", label: "分帳規則", href: financeHref.rules },
    { value: "settings", label: "設定", href: financeHref.settings },
  ];
  const active =
    tabs.find((t) => t.value !== "home" && pathname === t.href)?.value ??
    (pathname.startsWith(financeHref.day("")) ? "verify" : "home");

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-5 px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">水庫</h1>
        <p className="text-sm text-neutral-500">公司的錢在哪裡、在誰手上、在等誰</p>
      </div>

      {isLoading || !data || !me ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-72 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl opacity-50" />
        </div>
      ) : building ? (
        children
      ) : ready ? (
        <>
          <div className="-mx-4 overflow-x-auto border-b border-neutral-200 px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
            <SegmentedTabs<Tab>
              variant="underline"
              ariaLabel="水庫分頁"
              value={active}
              onChange={(tab) => router.push(tabs.find((t) => t.value === tab)!.href)}
              options={tabs}
              className="w-max [&>button]:whitespace-nowrap"
            />
          </div>
          {children}
        </>
      ) : (
        <NotBuilt state={data} />
      )}
    </div>
  );
}
