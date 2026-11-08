import { useParams } from "next/navigation";
import LessonTabs from "./LessonTabs";
import {
  useGetLessonQuery,
  useGetLessonStudentsQuery,
  type Lesson,
} from "@/store/slices/lessons";
import SubNavbar from "@/features/SubNavbar";
import { useMemo, useState } from "react";
import PeriodSection, { PeriodColumn } from "./PeriodSection";
import SettingSection from "./SettingSection";
import { Skeleton } from "@/components/ui/skeleton";
import LessonDetailHeader from "./LessonDetailHeader";
import AttendanceOverview from "./AttendanceOverview";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { useFinanceEnabled } from "@/features/nav/useFinanceEnabled";
import LessonSplitPanel from "@/features/finance/LessonSplitPanel";
import { weeklyScheduleLabel } from "../lessonSchedule";
import { headcountByPeriod } from "@/domains/attendance/rosterInsights";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import ConfirmDialog from "@/components/ConfirmDialog";

export const TABS = [
  { name: "時段", query: "periods" },
  { name: "學生", query: "students" },
  { name: "設定", query: "settings" },
];

export const FINANCE_TAB = { name: "分帳", query: "split" };

const LessonDetail = () => {
  const financeEnabled = useFinanceEnabled();
  const { id } = useParams();
  // 只掛載其中一棵樹。兩棵都掛的話 PeriodSection / AttendanceOverview /
  // SettingSection 會各跑兩次（見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";
  const [activeTab, setActiveTab] = useState("periods");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  /** What to do once the teacher agrees to throw unsaved settings away. */
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  const { data: lesson, isLoading: isLessonLoading } = useGetLessonQuery(
    id as string
  );
  const { data: students, isLoading: isStudentsLoading } =
    useGetLessonStudentsQuery({ id: parseInt(id as string) });

  const headcounts = useMemo(
    () =>
      new Map(
        headcountByPeriod(students ?? [], lesson?.periods ?? [])
          .filter((column) => column.taken)
          .map((column) => [column.periodId, column.attended])
      ),
    [students, lesson?.periods]
  );

  // Leaving the settings (closing the drawer, or switching tabs on a phone)
  // throws unsaved edits away — ask first.
  const discardSettingsThen = (action: () => void) => {
    if (!settingsDirty) {
      action();
      return;
    }
    setPendingDiscard(() => action);
  };
  const requestCloseSettings = () => discardSettingsThen(() => setShowSettings(false));
  const requestTabChange = (tab: string) => {
    if (activeTab === "settings" && tab !== "settings") discardSettingsThen(() => setActiveTab(tab));
    else setActiveTab(tab);
  };

  return (
    <>
      {!isExpanded && (
        <SubNavbar
          title={lesson?.name || ""}
          subtitle={lesson ? lessonSubtitle(lesson) : undefined}
          backUrl="/lessons"
          withTodoBell
        />
      )}
      {isLessonLoading || isStudentsLoading || !lesson ? (
        isExpanded ? (
          <div className="flex flex-col gap-7 px-10 pt-7">
            <div className="flex flex-col gap-3.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-9 w-56" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="flex max-w-[1240px] items-start gap-6">
              <div className="w-[300px] shrink-0 rounded-2xl border border-neutral-200 py-4">
                <PeriodTimelineSkeleton />
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-64 w-full rounded-2xl opacity-50" />
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
        /* 桌面：整頁一起捲；時段欄黏在畫面上、自己捲。編輯在右側抽屜。 */
        <div className="flex flex-col gap-7 px-10 pt-7 pb-14">
          <div className="max-w-[1240px]">
            <LessonDetailHeader lesson={lesson} onEdit={() => setShowSettings(true)} />
          </div>
          <div className="flex max-w-[1240px] items-start gap-6">
            <PeriodColumn
              lesson={lesson}
              periods={lesson.periods || []}
              headcounts={headcounts}
              className="sticky top-6 h-[calc(100vh-3rem)] max-h-[820px] w-[300px] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <AttendanceOverview lesson={lesson} students={students || []} />
              {financeEnabled && (
                <div className="mt-8 rounded-2xl border border-neutral-200 bg-white">
                  <LessonSplitPanel lesson={lesson} students={students || []} />
                </div>
              )}
            </div>
          </div>
          <ResponsiveDialog
            open={showSettings}
            onClose={requestCloseSettings}
            desktop="side"
            className="w-[620px] p-0 min-h-0"
          >
            <SettingSection
              lesson={lesson}
              variant="drawer"
              onClose={requestCloseSettings}
              onDone={() => {
                setSettingsDirty(false);
                setShowSettings(false);
              }}
              onDirtyChange={setSettingsDirty}
            />
          </ResponsiveDialog>
        </div>
      ) : (
        /* 手機：分頁 */
        <div>
          <LessonTabs activeTab={activeTab} onTabChange={requestTabChange} showFinance={financeEnabled} />
          {activeTab === "periods" && (
            <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
          )}
          {activeTab === "students" && (
            <div className="px-5 pb-4">
              <AttendanceOverview lesson={lesson} students={students || []} variant="compact" />
            </div>
          )}
          {activeTab === "settings" && (
            <SettingSection lesson={lesson} onDirtyChange={setSettingsDirty} />
          )}
          {financeEnabled && activeTab === "split" && (
            <LessonSplitPanel lesson={lesson} students={students || []} />
          )}
        </div>
      )}
      <ConfirmDialog
        open={pendingDiscard !== null}
        title="要捨棄變更嗎？"
        message="課程設定有還沒儲存的變更，離開後就不會保留。"
        confirmLabel="捨棄變更"
        variant="danger"
        onConfirm={() => {
          const action = pendingDiscard;
          setPendingDiscard(null);
          setSettingsDirty(false);
          action?.();
        }}
        onCancel={() => setPendingDiscard(null)}
      />
    </>
  );
};

/** 手機頁首的副標：「Sean · 每週五 20:00–21:00」；時段不規則時只寫老師。 */
const lessonSubtitle = (lesson: Lesson) =>
  [lesson.teachers.map((t) => t.name).join("、"), weeklyScheduleLabel(lesson.periods ?? [])]
    .filter(Boolean)
    .join(" · ") || undefined;

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
