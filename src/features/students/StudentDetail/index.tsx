"use client";

import { useState } from "react";
import BasicSection from "./BasicSection";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import EventTimeline from "./BasicSection/EventTimeline";
import { StudentWithDetail } from "@/store/slices/students";
import { useSearchParams } from "next/navigation";
import { useSizeClass } from "@/hooks/useMediaQuery";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";

type DetailTab = "basic" | "cards" | "attend" | "events";

const tabOptions: SegmentedOption<DetailTab>[] = [
  { label: "概要", value: "basic" },
  { label: "課卡", value: "cards" },
  { label: "出席", value: "attend" },
  { label: "動態", value: "events" },
];

const isDetailTab = (value: string | null): value is DetailTab =>
  tabOptions.some((option) => option.value === value);

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
  const [activeTab, setActiveTab] = useState<DetailTab>(isDetailTab(tab) ? tab : "cards");
  const isPane = layout === "tabs";
  // 只掛一棵樹：兩棵都掛的話 BasicSection / CardsSection / AttendSection
  // 在手機上也會全部被 mount（見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";

  const handleTabClick = (tab: DetailTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
  };

  const section = (
    <>
      {activeTab === "basic" && (
        <BasicSection student={student} isPublic={isPublic} withTimeline={false} />
      )}
      {activeTab === "cards" && (
        <CardsSection
          key={student.id}
          student={student}
          studentCards={student.studentCards}
          isPublic={isPublic}
          // 分割檢視的頁首已經有「購買課卡」。
          showBuy={!isPane}
        />
      )}
      {activeTab === "attend" && <AttendSection key={student.id} student={student} />}
      {activeTab === "events" && <EventTimeline key={student.id} studentId={student.id} />}
    </>
  );

  // 分割檢視右欄：分頁切換靠左（不撐滿），內容區自己捲動
  if (isPane) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-none px-6 py-3 border-b border-neutral-200">
          <SegmentedTabs
            ariaLabel="學生資料分頁"
            options={tabOptions}
            value={activeTab}
            onChange={handleTabClick}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">{section}</div>
      </div>
    );
  }

  // 獨立學生頁：桌面三欄
  if (isExpanded) {
    return (
      <div className="flex flex-1 min-h-[calc(100vh-140px)] overflow-hidden">
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
              showBuy={false}
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
    );
  }

  // 獨立學生頁：手機分頁
  return (
    <div className="px-5 py-3">
      <SegmentedTabs
        ariaLabel="學生資料分頁"
        options={tabOptions}
        value={activeTab}
        onChange={handleTabClick}
        fill
        className="mb-4"
      />
      {section}
    </div>
  );
};

export default StudentDetail;
