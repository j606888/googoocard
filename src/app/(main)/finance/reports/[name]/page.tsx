"use client";

import { notFound, useParams, useSearchParams } from "next/navigation";
import Navbar from "@/features/Navbar";
import { LedgerReportView, REPORT_TITLES } from "@/features/finance/ledger/LedgerReports";
import type { ReportName } from "@/service/ledger/reports";

const LedgerReportPage = () => {
  const { name } = useParams<{ name: string }>();
  const search = useSearchParams();
  if (!(name in REPORT_TITLES)) notFound();
  const accountId = search.get("accountId");
  return (
    <>
      <Navbar />
      <LedgerReportView name={name as ReportName} accountId={accountId ? Number(accountId) : undefined} />
    </>
  );
};

export default LedgerReportPage;
