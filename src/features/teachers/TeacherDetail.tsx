"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Pencil, Trash } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SegmentedTabs from "@/components/SegmentedTabs";
import EmptyState from "@/components/EmptyState";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { danceStyleClasses, danceStyleMeta } from "@/lib/danceStyleColors";
import { format } from "date-fns";
import { roleLabel } from "@/lib/roles";
import { TEACHER_KIND_LABELS } from "@/lib/teachers";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { studentDetailHref } from "@/lib/studentNav";
import type { PeriodState } from "@/lib/teacherStats";
import {
  useDeleteTeacherMutation,
  useGetTeacherQuery,
  useUpdateTeacherMutation,
  type TeacherDetail as Detail,
  type TeacherLessonRow,
} from "@/store/slices/teachers";
import MonthSwitcher from "./MonthSwitcher";
import StatTile from "./StatTile";
import TeacherAvatar from "./TeacherAvatar";
import TeacherForm from "./TeacherForm";
import { monthLabel, periodLabel, shortMonthLabel, sinceLabel } from "./format";
import { teacherIconGlyph } from "./teacherIcons";

type LessonTab = "inProgress" | "finished" | "assisted";

/** 細節頁的分頁，記在網址 `?tab=`（重新整理、返回都會回到同一頁）。 */
export const TEACHER_TABS = [
  { value: "lessons", label: "課程" },
  { value: "periods", label: "時段" },
  { value: "stats", label: "數字" },
  { value: "profile", label: "資料" },
] as const;
export type TeacherTab = (typeof TEACHER_TABS)[number]["value"];
export const isTeacherTab = (value: string | null): value is TeacherTab =>
  TEACHER_TABS.some((tab) => tab.value === value);

const PERIOD_STATE: Record<PeriodState, { label: string; tone: StatusTone }> = {
  done: { label: "已點名", tone: "positive" },
  pending: { label: "待點名", tone: "warning" },
  upcoming: { label: "未開始", tone: "neutral" },
};

const section = "rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-3";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function attendanceChange(detail: Detail): string | undefined {
  const previous = detail.previousMonthAttendance;
  if (previous === 0) return undefined;
  const pct = Math.round(((detail.stats.attendance - previous) / previous) * 100);
  return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs 上個月`;
}

/** 「週四 20:30」：第一堂的星期與時間。 */
function slotOf(lesson: TeacherLessonRow): string | null {
  if (!lesson.firstStart) return null;
  const start = new Date(lesson.firstStart);
  return `週${WEEKDAYS[start.getDay()]} ${format(start, "HH:mm")}`;
}

function progressOf(lesson: TeacherLessonRow): string {
  return lesson.kind === "ongoing"
    ? `已上 ${lesson.taughtCount} 堂`
    : `第 ${lesson.taughtCount}／${lesson.totalPeriods} 堂`;
}

/**
 * 老師細節：頂端只有頭像、名字、一行摘要；其他分成四個分頁，一次只看一件事——
 * 課程（教的／協助）、時段（某個月）、數字（月統計＋趨勢＋常來的學生）、資料（編輯／封存在這裡）。
 */
const TeacherDetail = ({
  id,
  initialMonth,
  tab,
  onTabChange,
}: {
  id: number;
  initialMonth: string;
  tab: TeacherTab;
  onTabChange: (tab: TeacherTab) => void;
}) => {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [lessonTab, setLessonTab] = useState<LessonTab>("inProgress");
  const [formKey, setFormKey] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, isError } = useGetTeacherQuery(
    { id, month },
    { refetchOnMountOrArgChange: true }
  );
  const { data: memberships } = useGetMembershipsQuery();
  const [updateTeacher] = useUpdateTeacherMutation();
  const [deleteTeacher, { isLoading: deleting }] = useDeleteTeacherMutation();

  if (isError) {
    return (
      <div className="px-5 py-10 text-center text-neutral-500">
        找不到這位老師。<Link href="/teachers" className="text-primary-700 underline">回老師列表</Link>
      </div>
    );
  }
  if (isLoading || !data) return <TeacherDetailSkeleton />;

  const { teacher } = data;
  const archived = Boolean(teacher.archivedAt);
  const account = memberships?.find((m) => m.userId === teacher.userId);
  const summary = [
    teacher.locations.map((l) => l.name).join("、"),
    TEACHER_KIND_LABELS[teacher.kind],
    data.firstTaughtAt ? `${sinceLabel(data.firstTaughtAt)}起` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const setArchived = async (value: boolean) => {
    try {
      await updateTeacher({ id: teacher.id, archived: value }).unwrap();
      toast.success(value ? `已封存 ${teacher.name}` : `已還原 ${teacher.name}`);
    } catch {
      toast.error("操作失敗，請稍後再試");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTeacher({ id: teacher.id }).unwrap();
      toast.success(`已刪除 ${teacher.name}`);
      router.push("/teachers");
    } catch {
      toast.error("刪除失敗，請稍後再試");
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-[1000px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5">
        <BackLink />

        <div className="flex flex-wrap items-center gap-4">
          <TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="lg" muted={archived} />
          <div className="flex flex-col gap-1 flex-[1_1_220px] min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{teacher.name}</h1>
              {archived && <StatusTag tone="neutral">已封存</StatusTag>}
            </div>
            {summary && <p className="text-sm text-neutral-500">{summary}</p>}
          </div>
        </div>

        <nav aria-label="老師細節" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          <div role="tablist" className="flex w-max gap-1 border-b border-neutral-200 lg:w-auto">
            {TEACHER_TABS.map((option) => {
              const active = option.value === tab;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(option.value)}
                  className={`-mb-px inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap border-b-2 px-4 text-[15px] transition-colors ${
                    active
                      ? "border-primary-600 font-bold text-primary-900"
                      : "border-transparent font-medium text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </nav>

        {tab === "lessons" && (
          <LessonsTab data={data} lessonTab={lessonTab} onLessonTabChange={setLessonTab} />
        )}
        {tab === "periods" && <PeriodsTab data={data} month={month} onMonthChange={setMonth} />}
        {tab === "stats" && <StatsTab data={data} month={month} onMonthChange={setMonth} />}
        {tab === "profile" && (
          <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
            <dl className="flex-1 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
              <ProfileRow label="名字">{teacher.name}</ProfileRow>
              <ProfileRow label="頭像">
                <span className="flex items-center gap-2">
                  <TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="sm" />
                  {teacherIconGlyph(teacher.icon)?.label ?? "名字第一個字"}
                </span>
              </ProfileRow>
              <ProfileRow label="身分">{TEACHER_KIND_LABELS[teacher.kind]}</ProfileRow>
              <ProfileRow label="分部">
                {teacher.locations.length ? teacher.locations.map((l) => l.name).join("、") : "—"}
              </ProfileRow>
              <ProfileRow label="帳號">
                {teacher.userId === null
                  ? "沒有帳號（可以從老師列表邀請）"
                  : account
                    ? `${account.user.email}（${roleLabel(account.role)}）`
                    : "已連結帳號"}
              </ProfileRow>
              <ProfileRow label="備註">
                {teacher.note ? (
                  <span className="whitespace-pre-line leading-relaxed">{teacher.note}</span>
                ) : (
                  <span className="text-neutral-500">—</span>
                )}
              </ProfileRow>
            </dl>
            <div className="flex flex-col gap-2.5 lg:w-60">
              <Button onClick={() => setFormKey(Date.now())}>
                <Pencil className="size-4" />
                編輯資料
              </Button>
              {/* 連著帳號的人要先從團隊移出，才能封存或刪除。 */}
              {teacher.userId !== null ? (
                <p className="text-xs leading-relaxed text-neutral-500">
                  連著帳號，要先從團隊移出才能封存。
                </p>
              ) : data.lessons.length === 0 && data.assistedLessons.length === 0 ? (
                <Button variant="dangerSecondary" onClick={() => setConfirmDelete(true)}>
                  <Trash className="size-4" />
                  刪除
                </Button>
              ) : archived ? (
                <Button variant="secondary" onClick={() => setArchived(false)}>
                  <ArchiveRestore className="size-4" />
                  還原
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setArchived(true)}>
                    <Archive className="size-4" />
                    封存
                  </Button>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    封存後不會出現在開課的老師選單，舊課照常顯示。
                  </p>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {formKey !== null && (
        <TeacherForm key={formKey} open teacher={teacher} onClose={() => setFormKey(null)} />
      )}
      <ConfirmDialog
        variant="danger"
        open={confirmDelete}
        title={`刪除 ${teacher.name}？`}
        message="這位老師沒有教過任何課，刪除後無法復原。"
        confirmLabel="刪除"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

const BackLink = () => (
  <Link
    href="/teachers"
    className="self-start -ml-1 flex items-center gap-0.5 text-sm text-neutral-500 hover:text-neutral-900"
  >
    <ChevronLeft className="w-4 h-4" />
    老師
  </Link>
);

const ProfileRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
    <dt className="text-neutral-500">{label}</dt>
    <dd>{children}</dd>
  </div>
);

const LessonsTab = ({
  data,
  lessonTab,
  onLessonTabChange,
}: {
  data: Detail;
  lessonTab: LessonTab;
  onLessonTabChange: (tab: LessonTab) => void;
}) => {
  const activeCount = data.lessons.filter((l) => l.status === "inProgress").length;
  const taught = data.lessons.filter((lesson) => lesson.status === lessonTab);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs<LessonTab>
        ariaLabel="課程"
        value={lessonTab}
        onChange={onLessonTabChange}
        className="self-start"
        options={[
          { value: "inProgress", label: "進行中", hint: activeCount },
          { value: "finished", label: "已結束", hint: data.lessons.length - activeCount },
          { value: "assisted", label: "協助", hint: data.assistedLessons.length },
        ]}
      />
      {lessonTab === "assisted" ? (
        data.assistedLessons.length === 0 ? (
          <EmptyState kind="inline" title="沒有當過小幫手的課。" />
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {data.assistedLessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/lessons/${lesson.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 lg:px-5"
                >
                  <span className={`size-2 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).dot}`} />
                  <span className="flex-1 truncate font-medium">{lesson.name}</span>
                  <span className="text-sm text-neutral-500">
                    {lesson.status === "inProgress" ? "進行中" : "已結束"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : taught.length === 0 ? (
        <EmptyState
          kind="inline"
          title={lessonTab === "inProgress" ? "目前沒有進行中的課。新增課程時就能指定這位老師。" : "還沒有結束的課。"}
        />
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {taught.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/lessons/${lesson.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-neutral-50 lg:grid lg:grid-cols-[minmax(0,1fr)_110px_120px_100px_16px] lg:px-5"
              >
                <span className="flex min-w-0 basis-full items-center gap-2.5 lg:basis-auto">
                  <span className={`size-2 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).dot}`} />
                  <span className="truncate font-medium">{lesson.name}</span>
                </span>
                <span className="text-sm text-neutral-600">{slotOf(lesson) ?? "還沒排時段"}</span>
                <span className="text-sm text-neutral-600">{progressOf(lesson)}</span>
                <span className="text-sm text-neutral-600">
                  {lesson.avgAttendance === null ? "—" : `平均 ${lesson.avgAttendance} 人`}
                </span>
                <ChevronRight className="hidden w-4 h-4 text-neutral-400 lg:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PeriodsTab = ({
  data,
  month,
  onMonthChange,
}: {
  data: Detail;
  month: string;
  onMonthChange: (month: string) => void;
}) => {
  const done = data.periods.filter((p) => p.state === "done").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={onMonthChange} />
        {data.periods.length > 0 && (
          <span className="text-sm text-neutral-500">
            已上 {done} 堂・還有 {data.periods.length - done} 堂
          </span>
        )}
      </div>
      {data.periods.length === 0 ? (
        <EmptyState kind="inline" title={`${monthLabel(month)}沒有排課。`} />
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {data.periods.map((period) => {
            const state = PERIOD_STATE[period.state];
            return (
              <li key={period.id}>
                <Link
                  href={`/lessons/${period.lessonId}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50 lg:px-5"
                >
                  <span className="w-32 shrink-0 text-sm font-medium tabular-nums">
                    {periodLabel(period.startTime)}
                  </span>
                  <span className="flex-1 truncate text-sm">{period.lessonName}</span>
                  <StatusTag tone={state.tone}>
                    {period.state === "done" ? `${state.label} ${period.attendance} 人` : state.label}
                  </StatusTag>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const StatsTab = ({
  data,
  month,
  onMonthChange,
}: {
  data: Detail;
  month: string;
  onMonthChange: (month: string) => void;
}) => {
  const { stats, teacher } = data;
  const maxAttendance = Math.max(1, ...data.trend.map((m) => m.attendance));
  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher month={month} onChange={onMonthChange} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="已上堂數"
          value={stats.sessions}
          unit="堂"
          hint={stats.pendingCount > 0 ? `另 ${stats.pendingCount} 堂待點名` : undefined}
        />
        <StatTile label="出席人次" value={stats.attendance} unit="人次" hint={attendanceChange(data)} />
        <StatTile label="不重複學生" value={stats.uniqueStudents} unit="人" />
        <StatTile label="平均每堂" value={stats.avgAttendance ?? "–"} unit={stats.avgAttendance === null ? undefined : "人"} />
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <section className={`${section} flex-[999_1_420px] min-w-0`}>
          <h3 className="font-semibold">近 6 個月出席人次</h3>
          <div className="flex items-end gap-2 h-32">
            {data.trend.map((bucket, i) => (
              <div key={bucket.month} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <span className="text-[11px] text-neutral-500 tabular-nums">{bucket.attendance}</span>
                <span
                  className={`w-full rounded-sm ${
                    i === data.trend.length - 1 ? danceStyleClasses(teacher.color).bg : "bg-neutral-200"
                  }`}
                  style={{ height: `${Math.max(3, Math.round((bucket.attendance / maxAttendance) * 80))}px` }}
                />
                <span className="text-[11px] text-neutral-500">{shortMonthLabel(bucket.month)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={`${section} flex-[1_1_260px] min-w-0`}>
          <h3 className="font-semibold">常來的學生</h3>
          {data.regulars.length === 0 ? (
            <EmptyState kind="inline" title="近 6 個月還沒有點名紀錄。" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.regulars.map((student) => (
                <li key={student.id}>
                  <Link
                    href={studentDetailHref(student.id, `/teachers/${teacher.id}?tab=stats`)}
                    className="flex items-center gap-3 hover:bg-neutral-50 -mx-2 px-2 py-1 rounded-lg"
                  >
                    <Image src={student.avatarUrl} alt="" width={32} height={32} className="rounded-full shrink-0" />
                    <span className="flex-1 truncate text-sm">{student.name}</span>
                    <span className="text-sm text-neutral-500 tabular-nums">{student.count} 堂</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-neutral-500">以近 6 個月點過名的時段計算。</p>
        </section>
      </div>
    </div>
  );
};

/** The detail page's shape while loading: back link is real, the rest mirrors the loaded layout. */
const TeacherDetailSkeleton = () => (
  <div className="w-full max-w-[1000px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5" aria-busy="true">
    <BackLink />
    <div className="flex items-center gap-4">
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    <div className="flex gap-1 border-b border-neutral-200">
      {TEACHER_TABS.map((t) => (
        <span key={t.value} className="inline-flex min-h-11 items-center px-4 text-[15px] font-medium text-neutral-400">
          {t.label}
        </span>
      ))}
    </div>
    <div className="rounded-2xl border border-neutral-200 bg-white">
      {["w-40", "w-28", "w-36"].map((width, i) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i === 2 ? "opacity-50" : ""}`}>
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className={`h-4 ${width}`} />
        </div>
      ))}
    </div>
  </div>
);

export default TeacherDetail;
