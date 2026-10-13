"use client";

import { useState } from "react";
import BasicSection from "./BasicSection";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import EventTimeline from "./BasicSection/EventTimeline";
import ProfilePanels from "./ProfilePanels";
import { StudentWithDetail } from "@/store/slices/students";
import { useSearchParams } from "next/navigation";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useElementWidth } from "@/hooks/useElementWidth";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";

type DetailTab = "basic" | "profile" | "cards" | "attend" | "events";

/** 公開頁、LIFF、手機版老師端：概要 + 三個分頁（舊版面，第 7 階段換掉手機老師端）。 */
const LEGACY_TABS: SegmentedOption<DetailTab>[] = [
  { label: "概要", value: "basic" },
  { label: "課卡", value: "cards" },
  { label: "出席", value: "attend" },
  { label: "動態", value: "events" },
];

/**
 * 側欄（舞種資格／學生資料／公開頁）擺得下的最小內容寬度。比這窄就收成
 * 「資料」分頁——分割檢視右欄在 1440 寬的螢幕上大約只有 800px。
 */
const SIDE_PANEL_MIN_WIDTH = 1000;

const isDetailTab = (value: string | null): value is DetailTab =>
  value === "basic" || value === "profile" || value === "cards" || value === "attend" || value === "events";

const StudentDetail = ({
  student,
  isPublic = false,
  variant = "page",
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
  /**
   * "page" —— 獨立學生頁（整頁捲動）。
   * "pane" —— 分割檢視右欄：分頁列固定、內容區自己捲動。
   */
  variant?: "page" | "pane";
}) => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<DetailTab>(isDetailTab(tab) ? tab : "cards");
  const isPane = variant === "pane";
  // 只掛一棵樹：兩棵都掛的話各分頁在手機上也會全部被 mount
  // （見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";
  const [rootRef, width] = useElementWidth<HTMLDivElement>();

  const handleTabClick = (next: DetailTab) => {
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  };

  // 公開頁／LIFF／手機老師端：舊的分頁版面
  if (isPublic || !isExpanded) {
    const legacyTab = activeTab === "profile" ? "basic" : activeTab;
    return (
      <div className="px-5 py-3">
        <SegmentedTabs
          ariaLabel="學生資料分頁"
          options={LEGACY_TABS}
          value={legacyTab}
          onChange={handleTabClick}
          fill
          className="mb-4"
        />
        {legacyTab === "basic" && <BasicSection student={student} isPublic={isPublic} withTimeline={false} />}
        {legacyTab === "cards" && (
          <CardsSection key={student.id} student={student} studentCards={student.studentCards} isPublic={isPublic} />
        )}
        {legacyTab === "attend" && <AttendSection key={student.id} student={student} />}
        {legacyTab === "events" && <EventTimeline key={student.id} studentId={student.id} />}
      </div>
    );
  }

  // 桌面老師端：課卡／出席／動態，右邊側欄；窄的時候側欄收成「資料」分頁。
  const withSidePanel = width >= SIDE_PANEL_MIN_WIDTH;
  const activeCount = student.studentCards.filter((c) => c.remainingSessions > 0 && !c.expiredAt).length;
  const tabs: SegmentedOption<DetailTab>[] = [
    { label: "課卡", value: "cards", hint: activeCount > 0 ? `${activeCount} 張有效` : undefined },
    { label: "出席", value: "attend", hint: student.overview.attendedCount || undefined },
    { label: "動態", value: "events" },
    ...(withSidePanel ? [] : [{ label: "資料", value: "profile" as const }]),
  ];
  const shownTab: DetailTab =
    activeTab === "basic" || (activeTab === "profile" && withSidePanel) ? "cards" : activeTab;

  return (
    <div ref={rootRef} className={isPane ? "flex flex-col flex-1 min-h-0" : "flex flex-col flex-1"}>
      <div className="flex-none bg-white border-b border-neutral-200 px-6 pt-3">
        <SegmentedTabs
          variant="underline"
          ariaLabel="學生資料分頁"
          options={tabs}
          value={shownTab}
          onChange={handleTabClick}
        />
      </div>
      <div className={isPane ? "flex-1 min-h-0 overflow-y-auto bg-neutral-50" : "flex-1 bg-neutral-50"}>
        <div
          className={`px-6 py-6 ${
            withSidePanel ? "grid grid-cols-[minmax(0,1fr)_300px] gap-6 items-start" : ""
          }`}
        >
          <div className="min-w-0">
            {shownTab === "cards" && (
              <CardsSection
                key={student.id}
                student={student}
                studentCards={student.studentCards}
                // 頁首已經有「購買課卡」。
                showBuy={false}
              />
            )}
            {shownTab === "attend" && <AttendSection key={student.id} student={student} />}
            {shownTab === "events" && <EventTimeline key={student.id} studentId={student.id} />}
            {shownTab === "profile" && <ProfilePanels student={student} />}
          </div>
          {withSidePanel && (
            <aside aria-label="學生資料">
              <ProfilePanels student={student} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
