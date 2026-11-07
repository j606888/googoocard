"use client";

import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import BranchSettings from "./BranchSettings";
import GeneralSettings from "./GeneralSettings";
import SetupChecklist from "./SetupChecklist";
import StrayReceivers from "./StrayReceivers";
import TeacherPayers from "./TeacherPayers";
import { useCanSettle } from "./useCanSettle";
import VenueSettings from "./VenueSettings";
import { JournalList, OpeningCard } from "./v2/SettingsExtras";

/** `hint`：標題下一行灰字，說什麼時候要動它。 */
function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <p className="mb-3 text-[13px] text-neutral-500">{hint}</p>
      {children}
    </section>
  );
}

/** /finance/settings：分部、老師付款人、場地與次數包、成員與舊卡預收。 */
export default function FinanceSettingsView() {
  const { data: settings, isLoading } = useGetFinanceSettingsQuery();
  const canSettle = useCanSettle();

  if (isLoading) return <Skeleton className="m-4 h-56 w-full max-w-3xl rounded-2xl" />;
  if (!settings?.enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;
  if (!canSettle) return <EmptyState kind="page" title="只有可以結算的人能改財務設定" />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SetupChecklist />
      <OpeningCard />
      <Section id="branches" title="分部" hint="開帳時設一次：負責人、公積金期初、過期的錢歸誰。之後很少動。">
        <BranchSettings />
      </Section>
      <Section id="teachers" title="老師付款人" hint="每位老師的薪水從誰手上的錢付。換老師或換人付時才要改。">
        <TeacherPayers />
      </Section>
      <Section id="venues" title="場地與次數包" hint="付場租的對象（外面的場地，或當房東的成員，例如丁丁家）。有新場地時才要動；平常買次數包到「支出與轉帳」記。">
        <VenueSettings />
      </Section>
      <Section id="receivers" title="收的錢在誰手上" hint="收款人不是保管人的錢（例如小幫手代收）會列在這裡，改記到實際拿錢的保管人。平常是空的。">
        <StrayReceivers />
      </Section>
      <Section id="general" title="成員與其他" hint="誰是保管人、誰可以結算；月結發錢取整；舊卡預收（開帳時確認一次）。">
        <GeneralSettings />
      </Section>
      <Section id="journal" title="手動分錄" hint="記錯了只能沖銷，不能刪改。新的在「記一筆 → 手動分錄」。">
        <JournalList />
      </Section>
    </div>
  );
}
