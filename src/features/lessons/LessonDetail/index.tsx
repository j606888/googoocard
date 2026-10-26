import { useParams } from "next/navigation";
import LessonTabs from "./LessonTabs";
import {
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import SubNavbar from "@/features/SubNavbar";
import { useState } from "react";
import PeriodSection from "./PeriodSection";
import SettingSection from "./SettingSection";
import { Skeleton } from "@/components/ui/skeleton";
import LessonDetailHeader from "./LessonDetailHeader";
import AttendanceOverview from "./AttendanceOverview";
import { useSizeClass } from "@/hooks/useMediaQuery";

export const TABS = [
  { name: "時段", query: "periods" },
  { name: "學生", query: "students" },
  { name: "設定", query: "settings" },
];

const LessonDetail = () => {
  const { id } = useParams();
  // 只掛載其中一棵樹。兩棵都掛的話 PeriodSection / AttendanceOverview /
  // SettingSection 會各跑兩次（見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";
  const [activeTab, setActiveTab] = useState("periods");
  const [showSettings, setShowSettings] = useState(false);
  const { data: lesson, isLoading: isLessonLoading } = useGetLessonQuery(
    id as string
  );
  const { data: students, isLoading: isStudentsLoading } =
    useGetLessonStudentsQuery({ id: parseInt(id as string) });

  return (
    <>
      {!isExpanded && (
        <SubNavbar
          title={lesson?.name || ""}
          subtitle={lesson?.group?.name}
          backUrl="/lessons"
          withTodoBell
        />
      )}
      {isLessonLoading || isStudentsLoading || !lesson ? (
        isExpanded ? (
          <div className="flex flex-col">
            <div className="border-b border-neutral-200 px-8 py-5 flex flex-col gap-4">
              <Skeleton className="h-3.5 w-40" />
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-xl" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-56" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5.5 w-16" />
                    <Skeleton className="h-5.5 w-14" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
            <div className="flex">
              <div className="w-96 flex-shrink-0 border-r border-neutral-200 py-4">
                <PeriodTimelineSkeleton />
              </div>
              <div className="flex-1 p-6 flex flex-col gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-48 w-full rounded-2xl opacity-50" />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <LessonTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <PeriodTimelineSkeleton />
          </div>
        )
      ) : isExpanded ? (
        /* 桌面：兩欄（＋可切換的設定欄） */
        <div className="flex flex-col min-h-[calc(100vh-0px)]">
          <LessonDetailHeader
            lesson={lesson}
            students={students || []}
            showSettings={showSettings}
            onToggleSettings={() => setShowSettings((v) => !v)}
          />
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Periods */}
            <div className="w-96 flex-shrink-0 border-r border-neutral-200 overflow-y-auto py-4">
              <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
            </div>
            {/* Center: Attendance matrix */}
            <div className="flex-1 overflow-auto p-6 bg-neutral-50/30">
              <AttendanceOverview lesson={lesson} students={students || []} />
            </div>
            {/* Right: Settings (toggleable) */}
            {showSettings && (
              <div className="w-72 flex-shrink-0 border-l border-neutral-200 overflow-y-auto py-4">
                <SettingSection lesson={lesson} />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 手機：分頁 */
        <div>
          <LessonTabs activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === "periods" && (
            <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
          )}
          {activeTab === "students" && (
            <div className="px-5 pb-4">
              <AttendanceOverview lesson={lesson} students={students || []} />
            </div>
          )}
          {activeTab === "settings" && <SettingSection lesson={lesson} />}
        </div>
      )}
    </>
  );
};

const TIMELINE_FADE = ["", "", "opacity-75", "opacity-50", "opacity-25"];

/** PeriodSection 的時間軸形狀：左邊圓點、右邊日期＋時間。 */
const PeriodTimelineSkeleton = () => (
  <div className="flex flex-col gap-4 px-5">
    <Skeleton className="h-4 w-28" />
    <div className="flex flex-col gap-5">
      {TIMELINE_FADE.map((fade, index) => (
        <div key={index} className={`flex items-center gap-3 ${fade}`}>
          <Skeleton className="size-5 shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className={`h-3.5 ${index % 2 ? "w-20" : "w-24"}`} />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

export default LessonDetail;
