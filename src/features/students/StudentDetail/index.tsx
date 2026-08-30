"use client";

import { useState } from "react";
import BasicSection from "./BasicSection";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import { StudentWithDetail } from "@/store/slices/students";
import { useSearchParams } from "next/navigation";

const tabs = [
  { label: "基本資料", query: "basic" },
  { label: "課卡", query: "cards" },
  { label: "出席", query: "attend" },
];

const StudentDetail = ({
  student,
  isPublic = false,
  layout = "auto",
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
  /**
   * "auto" —— 手機分頁、桌面三欄（獨立的學生頁）。
   * "tabs" —— 一律用分頁版面，給分割檢視的右欄用（寬度約 800px，放不下三欄）。
   */
  layout?: "auto" | "tabs";
}) => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tab || "cards");
  const isPane = layout === "tabs";

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  };

  const section = (
    <>
      {activeTab === "basic" && <BasicSection student={student} isPublic={isPublic} />}
      {activeTab === "cards" && (
        <CardsSection
          key={student.id}
          student={student}
          studentCards={student.studentCards}
          isPublic={isPublic}
          columns={isPane ? 2 : 1}
        />
      )}
      {activeTab === "attend" && <AttendSection key={student.id} student={student} />}
    </>
  );

  // 分割檢視右欄：分頁切換靠左（不撐滿），內容區自己捲動
  if (isPane) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-none px-6 py-3 border-b border-neutral-200">
          <div className="inline-flex gap-1 bg-neutral-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.query}
                className={`px-5 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
                  activeTab === tab.query
                    ? "bg-white text-neutral-900 font-semibold shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
                onClick={() => handleTabClick(tab.query)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">{section}</div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: tab-based layout */}
      <div className="lg:hidden px-5 py-3">
        <div className="flex w-full gap-1 mb-4 bg-neutral-100 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.query}
              className={`flex-1 text-center py-2 text-sm rounded-full cursor-pointer transition-colors ${
                activeTab === tab.query
                  ? "bg-white text-primary-700 font-semibold shadow-sm"
                  : "text-neutral-500"
              }`}
              onClick={() => handleTabClick(tab.query)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {section}
      </div>

      {/* Desktop: 3-panel layout */}
      <div className="hidden lg:flex lg:flex-1 lg:min-h-[calc(100vh-140px)] lg:overflow-hidden">
        {/* Left: Basic info */}
        <div className="w-80 flex-shrink-0 border-r border-neutral-200 overflow-y-auto">
          <div className="p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              學生資料
            </p>
            <BasicSection student={student} isPublic={isPublic} />
          </div>
        </div>

        {/* Center: Cards */}
        <div className="flex-1 overflow-y-auto bg-neutral-50/30">
          <div className="p-6">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              課卡
            </p>
            <CardsSection
              student={student}
              studentCards={student.studentCards}
              isPublic={isPublic}
            />
          </div>
        </div>

        {/* Right: Attendance */}
        <div className="w-96 flex-shrink-0 border-l border-neutral-200 overflow-y-auto">
          <div className="p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
              出席紀錄
            </p>
            <AttendSection student={student} />
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDetail;
