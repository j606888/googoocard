"use client";

import { usePathname, useRouter } from "next/navigation";
import SegmentedTabs from "@/components/SegmentedTabs";
import { financeHref, type FinancePage } from "./routes";

type Tab = Extract<FinancePage, "town" | "dashboard" | "ledger" | "funds" | "sessions" | "rules" | "close">;

const TABS: { value: Tab; label: string }[] = [
  { value: "town", label: "小鎮（新）" },
  { value: "dashboard", label: "儀表板" },
  { value: "ledger", label: "流水帳" },
  { value: "funds", label: "資金" },
  { value: "sessions", label: "場次分帳" },
  { value: "rules", label: "分帳規則" },
  { value: "close", label: "月結" },
];

/** 目前在哪個分頁：儀表板只認自己；其他分頁含底下的子頁（資金 → 小水庫、繳回、據點設定）。 */
function activeTab(pathname: string): Tab {
  const match = TABS.find(
    (tab) => tab.value !== "dashboard" && (pathname === financeHref(tab.value) || pathname.startsWith(`${financeHref(tab.value)}/`))
  );
  return match?.value ?? "dashboard";
}

/** 水庫的子分頁（底線分頁）；手機上放不下就橫向捲動。 */
export default function FinanceTabs() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="-mx-4 overflow-x-auto border-b border-neutral-200 px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
      <SegmentedTabs<Tab>
        variant="underline"
        ariaLabel="水庫分頁"
        value={activeTab(pathname)}
        onChange={(tab) => router.push(financeHref(tab))}
        options={TABS}
        className="w-max [&>button]:whitespace-nowrap"
      />
    </div>
  );
}
