"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import Navbar from "@/features/Navbar";
import DailyTab from "@/features/income/DailyTab";
import RecordsTab from "@/features/income/RecordsTab";

type Tab = "daily" | "records";

const TABS: { id: Tab; label: string }[] = [
  { id: "daily", label: "課程營收" },
  { id: "records", label: "課卡紀錄" },
];

const IncomePage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("daily");

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
                className={`px-3 py-1.5 rounded-sm text-sm cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === "daily" && <DailyTab />}
          {activeTab === "records" && <RecordsTab />}
        </div>

        {/* Desktop: side by side */}
        <div className="hidden lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8 lg:items-start">
          <DailyTab />
          <RecordsTab />
        </div>
      </div>
    </>
  );
};

export default IncomePage;
