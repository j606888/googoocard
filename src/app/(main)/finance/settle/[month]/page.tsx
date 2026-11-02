"use client";

import { useParams } from "next/navigation";
import Navbar from "@/features/Navbar";
import EmptyState from "@/components/EmptyState";
import StatementView from "@/features/finance/StatementView";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const SettlePage = () => {
  const { month } = useParams<{ month: string }>();
  return (
    <>
      <Navbar />
      {MONTH_KEY.test(month) ? <StatementView month={month} /> : <EmptyState kind="inline" title="月份格式不對" />}
    </>
  );
};

export default SettlePage;
