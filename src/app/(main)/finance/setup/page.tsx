"use client";

import { Suspense } from "react";
import SetupWizard from "@/features/finance/setup/SetupWizard";

// useSearchParams（?step=）要包 Suspense。
const FinanceSetupPage = () => (
  <Suspense>
    <SetupWizard />
  </Suspense>
);

export default FinanceSetupPage;
