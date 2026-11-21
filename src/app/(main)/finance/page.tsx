"use client";

import Navbar from "@/features/Navbar";
import FinanceHome from "@/features/finance/FinanceHome";

const FinancePage = () => (
  <>
    <Navbar />
    <div className="w-full max-w-[880px] px-5 py-4 lg:px-8 lg:py-6">
      <FinanceHome />
    </div>
  </>
);

export default FinancePage;
