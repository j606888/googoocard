"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetFinanceSettingsQuery } from "@/store/slices/finance";
import BranchSettings from "./BranchSettings";
import GeneralSettings from "./GeneralSettings";
import SetupChecklist from "./SetupChecklist";
import TeacherPayers from "./TeacherPayers";
import { useIsFinance } from "./useIsFinance";
import VenueSettings from "./VenueSettings";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-neutral-200 bg-white p-4 lg:p-5">
      <h2 className="mb-2 text-base font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

/** /finance/settings：分部、老師付款人、場地與次數包、成員與舊卡預收。 */
export default function FinanceSettingsView() {
  const { data: settings, isLoading } = useGetFinanceSettingsQuery();
  const isFinance = useIsFinance();

  if (isLoading) return <Skeleton className="m-4 h-56 w-full max-w-3xl rounded-2xl" />;
  if (!settings?.enabled) return <EmptyState kind="page" title="這間教室還沒開財務" />;
  if (!isFinance) return <EmptyState kind="page" title="只有財務成員可以改財務設定" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-neutral-900">財務設定</h1>
        <Link href="/finance" className="text-sm font-medium text-primary-700 underline-offset-4 hover:underline">
          回財務
        </Link>
      </div>
      <SetupChecklist />
      <Section id="branches" title="分部">
        <BranchSettings />
      </Section>
      <Section id="teachers" title="老師付款人">
        <TeacherPayers />
      </Section>
      <Section id="venues" title="場地與次數包">
        <VenueSettings />
      </Section>
      <Section id="general" title="成員與其他">
        <GeneralSettings />
      </Section>
    </div>
  );
}
