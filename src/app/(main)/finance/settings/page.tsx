"use client";

import Navbar from "@/features/Navbar";
import FinanceSettings from "@/features/finance/FinanceSettings";

const FinanceSettingsPage = () => (
  <>
    <Navbar />
    <div className="w-full max-w-[880px] px-5 py-4 lg:px-8 lg:py-6">
      <FinanceSettings />
    </div>
  </>
);

export default FinanceSettingsPage;
