"use client";

import type { ReactNode } from "react";
import Navbar from "@/features/Navbar";
import ModuleGate from "@/features/modules/ModuleGate";
import FinanceShell from "@/features/finance/FinanceShell";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <ModuleGate module="finance" permission="finance.view">
        <FinanceShell>{children}</FinanceShell>
      </ModuleGate>
    </>
  );
}
