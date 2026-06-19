"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import Navbar from "@/features/Navbar";
import DailyTab from "@/features/income/DailyTab";
import RecordsTab from "@/features/income/RecordsTab";
import UnpaidTab from "@/features/income/UnpaidTab";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";

type Tab = "daily" | "records" | "unpaid";

const TABS: { id: Tab; label: string }[] = [
  { id: "daily", label: "課程營收" },
  { id: "records", label: "課卡紀錄" },
  { id: "unpaid", label: "未付款" },
];

const IncomePage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const { data: unpaidCards } = useGetUnpaidStudentCardsQuery();
  const unpaidCount = unpaidCards?.length ?? 0;

  return (
    <>
      <Navbar />
      <div className="px-5 py-3 lg:px-8 lg:py-6">
        <div className="flex items-center gap-2 mb-3 lg:mb-6">
          <DollarSign className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-semibold">Income</h2>
        </div>

        {/* Mobile: tab switcher */}
        <div className="lg:hidden">
          <div className="flex gap-2 mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`relative px-3 py-1.5 rounded-sm text-sm cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary-500 text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.id === "unpaid" && unpaidCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-semibold align-middle">
                    {unpaidCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeTab === "daily" && <DailyTab />}
          {activeTab === "records" && <RecordsTab />}
          {activeTab === "unpaid" && <UnpaidTab />}
        </div>

        {/* Desktop: side by side, with unpaid below */}
        <div className="hidden lg:flex lg:flex-col lg:gap-8">
          <div className="grid grid-cols-[3fr_2fr] gap-8 items-start">
            <DailyTab />
            <RecordsTab />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">
              未付款
              {unpaidCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-danger-500 text-white text-xs font-semibold align-middle">
                  {unpaidCount}
                </span>
              )}
            </h3>
            <UnpaidTab />
          </div>
        </div>
      </div>
    </>
  );
};

export default IncomePage;
