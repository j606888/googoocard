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
import SegmentedTabs from "@/components/SegmentedTabs";
import ConfirmDialog from "@/components/ConfirmDialog";
import PeriodRecordSheet from "./PeriodRecordSheet";
import RevenueSplitPanel from "./RevenueSplitPanel";
import TermRoster from "./TermRoster";
import BookingRoster from "./BookingRoster";
import TrialRoster from "./TrialRoster";
import StudentSheet from "@/features/students/StudentSheet";
import { formatMoney } from "@/lib/money";
import TermHeader from "./TermHeader";
import PastTerms from "./PastTerms";
import { useTermPage } from "./useTermPage";

type DesktopTab = "periods" | "term" | "bookings" | "students" | "split" | "settings";
type MobileTab = "periods" | "students" | "split" | "settings";

const LessonDetail = () => {
  const { id } = useParams();
  // 只掛載其中一棵樹。兩棵都掛的話 PeriodSection / AttendanceOverview /
  // SettingSection 會各跑兩次（見 docs/ui-responsive.md 的「代價一」）。
  const isExpanded = useSizeClass() === "expanded";
  const [activeTab, setActiveTab] = useState<MobileTab>("periods");
  const [desktopTab, setDesktopTab] = useState<DesktopTab>("periods");
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
  const requestDesktopTab = (tab: DesktopTab) => {
    if (desktopTab === "settings" && tab !== "settings") discardSettingsThen(() => setDesktopTab(tab));
    else setDesktopTab(tab);
  };
  const requestTabChange = (tab: MobileTab) => {
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
        /* 桌面：頁首下面一排分頁，一次只看一種東西（時段／整期名單／預計會來／學生紀錄／分潤／設定）。 */
        <div className="flex flex-col px-12 pt-8 pb-14">
          <div className="max-w-[1240px]">
            <LessonDetailHeader lesson={lesson} onEdit={() => requestDesktopTab("settings")} />
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
            <SegmentedTabs<DesktopTab>
              variant="underline"
              ariaLabel="課程分頁"
              className="mt-6 border-b border-line"
              value={desktopTab}
              onChange={requestDesktopTab}
              options={[
                { value: "periods", label: "時段", hint: String(lesson.periods?.length ?? 0) },
                ...(lesson.termPrice != null ? [{ value: "term" as const, label: "整期名單" }] : []),
                { value: "bookings", label: "預計會來" },
                { value: "students", label: "學生紀錄" },
                { value: "split", label: "分潤" },
                { value: "settings", label: "設定" },
              ]}
            />
          </div>
          <div className="max-w-[1240px] pt-7">
            {desktopTab === "periods" && (
              <PeriodColumn
                lesson={lesson}
                periods={lesson.periods || []}
                headcounts={headcounts}
                revenues={term.revenues}
                activePeriodId={recordPeriodId}
                onViewRecord={setRecordPeriodId}
                className="max-w-[760px]"
              />
            )}
            {desktopTab === "term" && <TermRoster lesson={lesson} variant="table" />}
            {desktopTab === "bookings" && (
              <div className="flex max-w-[860px] flex-col gap-7">
                <BookingRoster lesson={lesson} />
                <TrialRoster lesson={lesson} />
              </div>
            )}
            {desktopTab === "students" && (
              <AttendanceOverview
                lesson={lesson}
                students={students || []}
                rosters={false}
                onViewPeriod={setRecordPeriodId}
                onOpenStudent={openStudent}
              />
            )}
            {desktopTab === "split" && <RevenueSplitPanel key={lesson.id} lesson={lesson} revenues={term.revenues} />}
            {desktopTab === "settings" && (
              <div className="max-w-[720px] overflow-hidden rounded-xl">
                <SettingSection
                  key={lesson.id}
                  lesson={lesson}
                  onDirtyChange={setSettingsDirty}
                  onDone={() => setSettingsDirty(false)}
                />
              </div>
            )}
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
        </div>
      ) : (
        /* 手機：這一期的頁首，下面時段、名單一路往下捲；設定從頁首的「編輯」進。 */
        <div className="pb-4">
          <TermHeader lesson={lesson} term={term} onOpenSettings={() => requestTabChange("settings")} />
          {/* 手機分頁：時段／學生（名單＋整期＋預計會來）／分潤／設定。 */}
          <SegmentedTabs<MobileTab>
            variant="underline"
            fill
            ariaLabel="課程分頁"
            className="mt-4 border-b border-line px-3"
            value={activeTab}
            onChange={requestTabChange}
            options={[
              { value: "periods", label: "時段" },
              { value: "students", label: "學生" },
              { value: "split", label: "分潤" },
              { value: "settings", label: "設定" },
            ]}
          />
          {activeTab === "settings" && <SettingSection lesson={lesson} onDirtyChange={setSettingsDirty} />}
          {activeTab === "periods" && (
            <>
              <PeriodSection
                lesson={lesson}
                periods={lesson?.periods || []}
                headcounts={headcounts}
                revenues={term.revenues}
                termRevenues={term.termRevenues}
              />
              <PastTerms terms={term.terms} currentLessonId={lesson.id} />
            </>
          )}
          {activeTab === "students" && (
            <div className="px-5 pt-6 pb-4">
              <AttendanceOverview lesson={lesson} students={students || []} variant="compact" />
            </div>
          )}
          {activeTab === "split" && (
            <div className="px-5 pt-6 pb-4">
              <RevenueSplitPanel key={lesson.id} lesson={lesson} revenues={term.revenues} />
            </div>
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
