"use client";

import FinanceSettingsView from "@/features/finance/FinanceSettingsView";
import { FinanceShell } from "@/features/finance/v2/ui";

const FinanceSettingsPage = () => (
  <FinanceShell title="財務設定">
    <FinanceSettingsView />
  </FinanceShell>
);

export default FinanceSettingsPage;
