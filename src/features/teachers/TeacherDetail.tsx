"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DanceStyleDot from "@/components/DanceStyleDot";
import InfoTip from "@/components/InfoTip";
import SegmentedTabs from "@/components/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COLOR_NAMES } from "@/features/danceStyles/PaletteColorPicker";
import type { PaletteColor } from "@/lib/danceStyles";
import { roleLabel } from "@/lib/roles";
import { TEACHER_KIND_LABELS } from "@/lib/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
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
import TeacherAvatar from "./TeacherAvatar";
import TeacherForm from "./TeacherForm";
import { monthLabel, periodLabel, shortMonthLabel, sinceLabel } from "./format";
import { attendanceChangeLabel, monthSentence, progressLabel, slotLabel } from "./teacherLessons";

type LessonStatus = "inProgress" | "finished";

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

/** 時段的點名狀態寫成字：要處理的才用琥珀色，其餘是最淺的字。 */
const PERIOD_STATE: Record<PeriodState, { label: string; className: string }> = {
  done: { label: "已點名", className: "text-ink-3" },
  pending: { label: "待點名", className: "font-semibold text-warning-800" },
  upcoming: { label: "未開始", className: "text-ink-3" },
};

const SHELL = "flex w-full flex-col px-5 pt-2 pb-10 lg:max-w-[1000px] lg:px-12 lg:pt-7";
const HEADING = "text-[17px] font-semibold text-ink";
const NOTE = "text-[13px] tabular-nums text-ink-3";
const EMPTY = "py-3 text-sm text-ink-3";
/** 可以點的一列：滑過去淡綠底，左右各讓出一點空氣。 */
const ROW_LINK =
  "-mx-3 flex min-h-13 items-center gap-3 rounded-xl px-3 py-2 outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-primary-300";

/** 手機上大區塊之間的 8px 淺灰帶；桌面靠留白（下一個區塊自己加 `lg:mt-9`）或分欄。 */
const Band = () => <div aria-hidden="true" className="-mx-5 my-7 h-2 bg-band lg:hidden" />;

/**
 * 老師細節：頂端只有頭像、名字、一行摘要；其他分成四個分頁，一次只看一件事——
 * 課程（教的／協助的，各自進行中或已結束）、時段（某個月）、數字（月統計＋趨勢＋常來的學生）、
 * 資料（編輯／封存在這裡）。不包框：一組一個標題，列與列之間一條細線。
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
  const [lessonStatus, setLessonStatus] = useState<LessonStatus>("inProgress");
  const [formKey, setFormKey] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, isError } = useGetTeacherQuery(
    { id, month },
    { refetchOnMountOrArgChange: true }
  );
  const { data: memberships } = useGetMembershipsQuery();
  const { data: locationData } = useGetLocationsQuery();
  const [updateTeacher] = useUpdateTeacherMutation();
  const [deleteTeacher, { isLoading: deleting }] = useDeleteTeacherMutation();

  if (isError) {
    return (
      <div className="px-5 py-10 text-center text-ink-3">
        找不到這位老師。<Link href="/teachers" className="font-semibold text-primary-800 underline">回老師列表</Link>
      </div>
    );
  }
  if (isLoading || !data) return <TeacherDetailSkeleton />;

  const { teacher } = data;
  const archived = Boolean(teacher.archivedAt);
  const account = memberships?.find((m) => m.userId === teacher.userId);
  const showLocation = (locationData?.locations ?? []).filter((l) => !l.archivedAt).length >= 2;
  const summary = [
    archived ? "已封存" : null,
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
      <div className={SHELL}>
        <BackLink />

        <header className="mt-1 flex items-center gap-4">
          <TeacherAvatar name={teacher.name} color={teacher.color} size="lg" muted={archived} />
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-semibold leading-9 text-ink">{teacher.name}</h1>
            {summary && <p className="text-[13px] text-ink-3">{summary}</p>}
          </div>
        </header>

        <SegmentedTabs<TeacherTab>
          variant="underline"
          ariaLabel="老師細節"
          value={tab}
          onChange={onTabChange}
          options={TEACHER_TABS}
          className="mt-5 mb-6 border-b border-line"
        />

        {tab === "lessons" && (
          <LessonsTab data={data} status={lessonStatus} onStatusChange={setLessonStatus} showLocation={showLocation} />
        )}
        {tab === "periods" && <PeriodsTab data={data} month={month} onMonthChange={setMonth} />}
        {tab === "stats" && <StatsTab data={data} month={month} onMonthChange={setMonth} />}
        {tab === "profile" && (
          <div className="lg:max-w-[640px]">
            <section aria-labelledby="profile-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="profile-heading" className={HEADING}>
                  基本資料
                </h2>
                <Button variant="text" size="sm" onClick={() => setFormKey(Date.now())}>
                  編輯
                </Button>
              </div>
              <dl className="mt-1 divide-y divide-line border-b border-line">
                <ProfileRow label="名字">{teacher.name}</ProfileRow>
                <ProfileRow label="代表色">
                  <span className="flex items-center gap-2">
                    <TeacherAvatar name={teacher.name} color={teacher.color} className="size-6 text-xs" />
                    {COLOR_NAMES[teacher.color as PaletteColor] ?? "—"}
                  </span>
                </ProfileRow>
                <ProfileRow label="身分">{TEACHER_KIND_LABELS[teacher.kind]}</ProfileRow>
                <ProfileRow label="分部">
                  {teacher.locations.length ? teacher.locations.map((l) => l.name).join("、") : "—"}
                </ProfileRow>
                <ProfileRow label="備註">
                  {teacher.note ? <span className="whitespace-pre-line leading-relaxed">{teacher.note}</span> : "—"}
                </ProfileRow>
              </dl>
            </section>

            <Band />

            <section aria-labelledby="account-heading" className="lg:mt-9">
              <h2 id="account-heading" className={HEADING}>
                帳號
              </h2>
              <dl className="mt-1 divide-y divide-line border-b border-line">
                <ProfileRow label="登入帳號">
                  {teacher.userId === null
                    ? "還沒邀請（可以從老師列表邀請）"
                    : account
                      ? `${account.user.email}（${roleLabel(account.role)}）`
                      : "已加入"}
                </ProfileRow>
              </dl>
              {/* 連著帳號的人要先從團隊移出，才能封存或刪除。 */}
              <div className="-ml-2 mt-2 flex min-h-11 items-center gap-1">
                {teacher.userId !== null ? (
                  <p className="ml-2 text-[13px] text-ink-3">連著帳號，要先從團隊移出才能封存。</p>
                ) : data.lessons.length === 0 && data.assistedLessons.length === 0 ? (
                  <Button
                    variant="text"
                    size="sm"
                    className="text-danger-700 hover:bg-danger-50 hover:text-danger-700"
                    onClick={() => setConfirmDelete(true)}
                  >
                    刪除這位老師
                  </Button>
                ) : archived ? (
                  <Button variant="text" size="sm" onClick={() => setArchived(false)}>
                    還原
                  </Button>
                ) : (
                  <>
                    <Button variant="text" size="sm" onClick={() => setArchived(true)}>
                      封存
                    </Button>
                    <InfoTip label="封存說明">封存後不會出現在開課的老師選單，舊課照常顯示。</InfoTip>
                  </>
                )}
              </div>
            </section>
          </div>
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
    className="-ml-1 flex min-h-11 items-center gap-0.5 self-start text-[13px] text-ink-3 hover:text-ink"
  >
    <ChevronLeft className="size-4" />
    老師
  </Link>
);

const ProfileRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid min-h-13 grid-cols-[88px_minmax(0,1fr)] items-center gap-4 py-2.5 text-[15px]">
    <dt className="text-ink-3">{label}</dt>
    <dd className="text-ink">{children}</dd>
  </div>
);

/** 課程分頁：「教的課」「協助的課」兩組（角色），上面一顆開關切進行中／已結束（狀態）。 */
const LessonsTab = ({
  data,
  status,
  onStatusChange,
  showLocation,
}: {
  data: Detail;
  status: LessonStatus;
  onStatusChange: (status: LessonStatus) => void;
  showLocation: boolean;
}) => {
  const all = [...data.lessons, ...data.assistedLessons];
  const activeCount = all.filter((l) => l.status === "inProgress").length;
  const taught = data.lessons.filter((lesson) => lesson.status === status);
  const assisted = data.assistedLessons.filter((lesson) => lesson.status === status);
  return (
    <div className="flex flex-col">
      <SegmentedTabs<LessonStatus>
        ariaLabel="課程狀態"
        value={status}
        onChange={onStatusChange}
        className="mb-6 self-start"
        options={[
          { value: "inProgress", label: "進行中", hint: activeCount },
          { value: "finished", label: "已結束", hint: all.length - activeCount },
        ]}
      />
      <LessonGroup
        id="taught-heading"
        title="教的課"
        lessons={taught}
        showLocation={showLocation}
        empty={status === "inProgress" ? "目前沒有進行中的課。新增課程時就能指定這位老師。" : "還沒有結束的課。"}
      />
      {/* 從來沒當過小幫手的人不列這一組。 */}
      {data.assistedLessons.length > 0 && (
        <>
          <Band />
          <LessonGroup
            id="assisted-heading"
            className="lg:mt-9"
            title="協助的課"
            lessons={assisted}
            showLocation={showLocation}
            empty={status === "inProgress" ? "目前沒有協助中的課。" : "還沒有協助過已結束的課。"}
          />
        </>
      )}
    </div>
  );
};

/** 一組課，教的、協助的同一個列：課名、時段、第幾堂、平均人數。 */
const LessonGroup = ({
  id,
  title,
  lessons,
  showLocation,
  empty,
  className,
}: {
  id: string;
  title: string;
  lessons: TeacherLessonRow[];
  showLocation: boolean;
  empty: string;
  className?: string;
}) => (
  <section aria-labelledby={id} className={className}>
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      {lessons.length > 0 && <span className={NOTE}>{lessons.length} 門</span>}
    </div>
    {lessons.length === 0 ? (
      <p className={EMPTY}>{empty}</p>
    ) : (
      <ul className="mt-1 divide-y divide-line border-b border-line">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/lessons/${lesson.id}`}
              className={`${ROW_LINK} flex-wrap gap-y-0.5 lg:grid lg:grid-cols-[minmax(0,1fr)_112px_112px_104px_16px] lg:gap-x-4`}
            >
              <span className="flex min-w-0 basis-full items-center gap-2.5 lg:basis-auto">
                <DanceStyleDot style={lesson.danceStyle} />
                <span className="truncate text-[15px] font-medium text-ink">{lesson.name}</span>
                {showLocation && lesson.location && (
                  <span className="shrink-0 text-[13px] text-ink-3">{lesson.location.name}</span>
                )}
              </span>
              <span className="pl-[18px] text-[13px] tabular-nums text-ink-3 lg:pl-0 lg:text-sm lg:text-ink-2">
                {slotLabel(lesson.nextStart ?? lesson.lastStart) ?? "還沒排時段"}
              </span>
              <span className="text-[13px] tabular-nums text-ink-3 lg:text-sm lg:text-ink-2">
                {progressLabel(lesson)}
              </span>
              <span className="text-[13px] tabular-nums text-ink-3 lg:text-sm lg:text-ink-2">
                {lesson.avgAttendance === null ? "還沒點過名" : `平均 ${lesson.avgAttendance} 人`}
              </span>
              <ChevronRight aria-hidden="true" className="hidden size-4 text-ink-3 lg:block" />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);

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
    <section aria-label={`${monthLabel(month)}的時段`} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <MonthSwitcher month={month} onChange={onMonthChange} />
        {data.periods.length > 0 && (
          <span className={NOTE}>
            已上 {done} 堂 · 還有 {data.periods.length - done} 堂
          </span>
        )}
      </div>
      {data.periods.length === 0 ? (
        <p className={EMPTY}>{monthLabel(month)}沒有排課。</p>
      ) : (
        <ul className="mt-1 divide-y divide-line border-b border-line">
          {data.periods.map((period) => {
            const state = PERIOD_STATE[period.state];
            return (
              <li key={period.id}>
                <Link href={`/lessons/${period.lessonId}`} className={ROW_LINK}>
                  <span className="w-[7.5rem] shrink-0 text-[15px] tabular-nums text-ink-2">
                    {periodLabel(period.startTime)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                    {period.lessonName}
                  </span>
                  <span className={`shrink-0 text-[13px] tabular-nums ${state.className}`}>
                    {period.state === "done" ? `${state.label} ${period.attendance} 人` : state.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/** 數字分頁：這個月寫成一句話，近 6 個月一排長條，常來的學生一份清單——都不包框。 */
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
  const sentence = monthSentence(stats);
  const aside = [
    stats.pendingCount > 0 ? `另 ${stats.pendingCount} 堂待點名` : null,
    sentence ? attendanceChangeLabel(stats.attendance, data.previousMonthAttendance) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col">
      <section aria-label={`${monthLabel(month)}的數字`}>
        <MonthSwitcher month={month} onChange={onMonthChange} />
        <p className={`mt-2 ${sentence ? `${HEADING} tabular-nums leading-relaxed` : "text-sm text-ink-3"}`}>
          {sentence ?? `${monthLabel(month)}還沒有點過名的課。`}
        </p>
        {aside && <p className={`mt-0.5 ${NOTE}`}>{aside}</p>}
      </section>

      <Band />

      <div className="lg:mt-9 lg:grid lg:grid-cols-2 lg:gap-x-16">
        <section aria-labelledby="trend-heading">
          <h2 id="trend-heading" className={HEADING}>
            近 6 個月出席人次
          </h2>
          <ol className="mt-4 flex h-36 items-end gap-3">
            {data.trend.map((bucket, i) => {
              const current = i === data.trend.length - 1;
              return (
                <li key={bucket.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className={`text-[13px] tabular-nums ${current ? "font-semibold text-ink" : "text-ink-3"}`}>
                    {bucket.attendance}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`w-full max-w-12 rounded-t-[3px] ${current ? "bg-primary-800" : "bg-primary-300"}`}
                    style={{ height: `${Math.max(3, Math.round((bucket.attendance / maxAttendance) * 84))}px` }}
                  />
                  <span className={`text-[13px] ${current ? "font-semibold text-ink" : "text-ink-3"}`}>
                    {shortMonthLabel(bucket.month)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <Band />

        <section aria-labelledby="regulars-heading">
          <div className="flex items-center gap-1">
            <h2 id="regulars-heading" className={HEADING}>
              常來的學生
            </h2>
            <InfoTip label="常來的學生說明">以近 6 個月點過名的時段計算。</InfoTip>
          </div>
          {data.regulars.length === 0 ? (
            <p className={EMPTY}>近 6 個月還沒有點名紀錄。</p>
          ) : (
            <ul className="mt-1 divide-y divide-line border-b border-line">
              {data.regulars.map((student) => (
                <li key={student.id}>
                  <Link href={studentDetailHref(student.id, `/teachers/${teacher.id}?tab=stats`)} className={ROW_LINK}>
                    <Image src={student.avatarUrl} alt="" width={32} height={32} className="shrink-0 rounded-full" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{student.name}</span>
                    <span className={NOTE}>{student.count} 堂</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

/** The detail page's shape while loading: back link is real, the rest mirrors the loaded layout. */
const TeacherDetailSkeleton = () => (
  <div className={SHELL} aria-busy="true">
    <BackLink />
    <div className="mt-1 flex items-center gap-4">
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    <div className="mt-5 mb-6 flex gap-1 border-b border-line">
      {TEACHER_TABS.map((t) => (
        <span key={t.value} className="inline-flex min-h-11 items-center px-3.5 text-sm font-medium text-ink-3">
          {t.label}
        </span>
      ))}
    </div>
    <ul className="divide-y divide-line">
      {["w-40", "w-28", "w-36"].map((width, i) => (
        <li key={i} className={`flex min-h-13 items-center gap-3 ${i === 2 ? "opacity-50" : ""}`}>
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className={`h-4 ${width}`} />
        </li>
      ))}
    </ul>
  </div>
);

export default TeacherDetail;
