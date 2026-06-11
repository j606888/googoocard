"use client";

import { useState } from "react";
import BasicSection from "./BasicSection";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import { StudentWithDetail } from "@/store/slices/students";
import { useSearchParams } from "next/navigation";

const tabs = [
  { label: "Basic", query: "basic" },
  { label: "Cards", query: "cards" },
  { label: "Attend", query: "attend" },
];

const StudentDetail = ({
  student,
  isPublic = false,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
}) => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tab || tabs[0].query);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  };

  return (
    <>
      {/* Mobile: tab-based layout */}
      <div className="lg:hidden px-5 py-3">
        <div className="flex w-full gap-1 mb-4 bg-gray-100 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.query}
              className={`flex-1 text-center py-2 text-sm rounded-full cursor-pointer transition-colors ${
                activeTab === tab.query
                  ? "bg-white text-primary-700 font-semibold shadow-sm"
                  : "text-gray-500"
              }`}
              onClick={() => handleTabClick(tab.query)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "basic" && (
          <BasicSection student={student} isPublic={isPublic} />
        )}
        {activeTab === "cards" && (
          <CardsSection
            student={student}
            studentCards={student.studentCards}
            isPublic={isPublic}
          />
        )}
        {activeTab === "attend" && <AttendSection student={student} />}
      </div>

      {/* Desktop: 3-panel layout */}
      <div className="hidden lg:flex lg:flex-1 lg:min-h-[calc(100vh-140px)] lg:overflow-hidden">
        {/* Left: Basic info */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Student Info
            </p>
            <BasicSection student={student} isPublic={isPublic} />
          </div>
        </div>

        {/* Center: Cards */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30">
          <div className="p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Payment Cards
            </p>
            <CardsSection
              student={student}
              studentCards={student.studentCards}
              isPublic={isPublic}
            />
          </div>
        </div>

        {/* Right: Attendance */}
        <div className="w-96 flex-shrink-0 border-l border-gray-200 overflow-y-auto">
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Attendance History
            </p>
            <AttendSection student={student} />
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDetail;
