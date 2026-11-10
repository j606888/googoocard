"use client";

import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetFinanceSettingsQuery, useGetFinanceTeachersQuery } from "@/store/slices/finance";
import BranchSettings from "./BranchSettings";
import GeneralSettings from "./GeneralSettings";
import SetupBanner from "./SetupBanner";
import StrayReceivers from "./StrayReceivers";
import TeacherLinkSuggestions from "./TeacherLinkSuggestions";
import { useCanSettle } from "./useCanSettle";
import VenueSettings, { NoVenueFeeToggle } from "./VenueSettings";
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

/**
 * 有沒連帳號、又跟某位成員同名的老師才出現：連好之後他的收入和薪水才對得起來。
 * 老師的錢由上課那個分部的負責人付，這裡不用設付款人。
 */
function TeacherLinks() {
  const { data } = useGetFinanceTeachersQuery();
  if (!data?.teachers.some((t) => t.linkSuggestion)) return null;
  return (
    <Section id="teachers" title="老師與帳號" hint="這幾位老師好像就是教室的成員，連結帳號之後他的收入和薪水才會對在一起。">
      <TeacherLinkSuggestions className="flex flex-col divide-y divide-neutral-100" />
    </Section>
  );
}

/** /finance/settings：分部、（有建議時）老師連帳號、場地與次數包、成員與舊卡預收。 */
export default function FinanceSettingsView() {
  const { data: settings, isLoading } = useGetFinanceSettingsQuery();
  const canSettle = useCanSettle();

  if (isLoading) return <Skeleton className="m-4 h-56 w-full max-w-3xl rounded-2xl" />;
  if (!settings?.enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;
  if (!canSettle) return <EmptyState kind="page" title="只有可以結算的人能改財務設定" />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SetupBanner />
      <OpeningCard />
      <Section id="branches" title="分部" hint="開帳時設一次：負責人、公積金期初、過期的錢歸誰。之後很少動。">
        <BranchSettings />
      </Section>
      <TeacherLinks />
      <Section id="venues" title="場地與次數包" hint="付場租的對象（外面的場地，或當房東的成員，例如丁丁家）。買了次數包也在這裡記。">
        <NoVenueFeeToggle />
        <VenueSettings />
      </Section>
      <Section id="general" title="成員與其他" hint="誰是保管人、誰可以結算；發錢取整；舊卡的錢在誰手上（開帳用）。">
        <GeneralSettings />
      </Section>
      <Section id="receivers" title="收的錢在誰手上" hint="收款人不是保管人的錢（例如小幫手代收）會列在這裡，改記到實際拿錢的保管人。平常是空的。">
        <StrayReceivers />
      </Section>
      <Section id="journal" title="手動分錄" hint="記錯了只能沖銷，不能刪改。新的在「記一筆 → 手動分錄」。">
        <JournalList />
      </Section>
    </div>
  );
}
