"use client";

import { notFound, useParams, useSearchParams } from "next/navigation";
import { REPORTS, ReportView } from "@/features/finance/v2/Reports";
import type { ReportName } from "@/service/ledger/reports";

const LedgerReportPage = () => {
  const { name } = useParams<{ name: string }>();
  const search = useSearchParams();
  if (!(name in REPORTS)) notFound();
  const accountId = search.get("accountId");
  return <ReportView key={name} name={name as ReportName} accountId={accountId ? Number(accountId) : undefined} />;
};

export default LedgerReportPage;
