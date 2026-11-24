import { useParams } from "next/navigation";
import {
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import { useMemo, useState } from "react";
import PeriodSection, { PeriodColumn } from "./PeriodSection";
import SettingSection from "./SettingSection";
import { Skeleton } from "@/components/ui/skeleton";
import LessonDetailHeader from "./LessonDetailHeader";
import AttendanceOverview from "./AttendanceOverview";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { headcountByPeriod } from "@/domains/attendance/rosterInsights";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import PeriodRecordSheet from "./PeriodRecordSheet";
import StudentSheet from "@/features/students/StudentSheet";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import TermHeader from "./TermHeader";
import PastTerms from "./PastTerms";
import { useTermPage } from "./useTermPage";

const LessonDetail = () => {
  const { id } = useParams();
  // 只掛載其中一棵樹。兩棵都掛的話 PeriodSection / AttendanceOverview /
  // SettingSection 會各跑兩次（見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";
  const [activeTab, setActiveTab] = useState("periods");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  // 桌面：時段紀錄與學生詳情開在右側抽屜，名單留在原地。一次只開一個。
  const [recordPeriodId, setRecordPeriodId] = useState<number | null>(null);
  const [sheetStudentId, setSheetStudentId] = useState<number | null>(null);
  const openStudent = (studentId: number) => {
    setRecordPeriodId(null);
    setSheetStudentId(studentId);
  };
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

  const term = useTermPage(lesson, headcounts);

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
              <div className="w-[328px] shrink-0 rounded-2xl border border-neutral-200 py-4">
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
          <div aria-busy="true">
            <div className="flex flex-col gap-3 px-5 pt-14 pb-8">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <PeriodTimelineSkeleton />
          </div>
        )
      ) : isExpanded ? (
        /* 桌面：整頁一起捲；時段欄黏在畫面上、自己捲。編輯在右側抽屜。 */
        <div className="flex flex-col gap-9 px-12 pt-8 pb-14">
          <div className="max-w-[1240px]">
            <LessonDetailHeader lesson={lesson} onEdit={() => setShowSettings(true)} />
            {/* 三張統計小卡收成一行灰字（去框線改版：不放統計列）。 */}
            {term.overview && (
              <p className="mt-4 text-[13px] text-ink-2">
                {term.termNumber !== null && `第 ${term.termNumber} 期 · `}
                已上 <b className="font-semibold text-ink">{term.overview.sessions}</b> 堂 · 平均出席{" "}
                <b className="font-semibold text-ink">{term.overview.average}</b> ·{" "}
                {term.termNumber !== null ? "這期收入" : "累計收入"}{" "}
                <b className="font-semibold text-ink">
                  {term.totalRevenue === undefined ? "…" : `$${formatMoney(term.totalRevenue)}`}
                </b>
              </p>
            )}
          </div>
          <div className="flex max-w-[1240px] items-start gap-14">
            <PeriodColumn
              lesson={lesson}
              periods={lesson.periods || []}
              headcounts={headcounts}
              activePeriodId={recordPeriodId}
              onViewRecord={setRecordPeriodId}
              className="sticky top-6 h-[calc(100vh-3rem)] max-h-[820px] w-[300px] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <AttendanceOverview
                lesson={lesson}
                students={students || []}
                onViewPeriod={setRecordPeriodId}
                onOpenStudent={openStudent}
              />
            </div>
          </div>
          <PeriodRecordSheet
            lesson={lesson}
            students={students || []}
            periodId={recordPeriodId}
            onSelect={setRecordPeriodId}
            onClose={() => setRecordPeriodId(null)}
            onOpenStudent={openStudent}
          />
          <StudentSheet
            studentId={sheetStudentId}
            onClose={() => setSheetStudentId(null)}
            from={`/lessons/${lesson.id}`}
          />
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
        /* 手機：這一期的頁首，下面時段、名單一路往下捲；設定從頁首的「編輯」進。 */
        <div className="pb-4">
          <TermHeader lesson={lesson} term={term} onOpenSettings={() => setActiveTab("settings")} />
          {activeTab === "settings" ? (
            <>
              <div className="flex items-center justify-between px-5 pt-3">
                <h2 className="text-[17px] font-semibold text-ink">編輯課程</h2>
                <Button variant="text" size="sm" onClick={() => requestTabChange("periods")}>
                  完成
                </Button>
              </div>
              <SettingSection lesson={lesson} onDirtyChange={setSettingsDirty} />
            </>
          ) : (
            /* 去框線改版：不再分「時段／學生」兩個分頁，整頁往下捲；大區塊之間 8px 淺灰帶。 */
            <>
              <div aria-hidden="true" className="mt-6 h-2 bg-band" />
              <PeriodSection
                lesson={lesson}
                periods={lesson?.periods || []}
                headcounts={headcounts}
                revenues={term.revenues}
                termRevenues={term.termRevenues}
              />
              <PastTerms terms={term.terms} currentLessonId={lesson.id} />
              <div aria-hidden="true" className="mt-6 h-2 bg-band" />
              <div className="px-5 pt-6 pb-4">
                <AttendanceOverview lesson={lesson} students={students || []} variant="compact" />
              </div>
            </>
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
