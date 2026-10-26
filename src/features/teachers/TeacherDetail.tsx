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
import { lessonLevelLabel } from "@/lib/danceLevels";
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

type LessonTab = "inProgress" | "finished";

const PERIOD_STATE: Record<PeriodState, { label: string; tone: StatusTone }> = {
  done: { label: "已點名", tone: "positive" },
  pending: { label: "待點名", tone: "warning" },
  upcoming: { label: "未開始", tone: "neutral" },
};

const section = "rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-3";

function attendanceChange(detail: Detail): string | undefined {
  const previous = detail.previousMonthAttendance;
  if (previous === 0) return undefined;
  const pct = Math.round(((detail.stats.attendance - previous) / previous) * 100);
  return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs 上個月`;
}

function lessonMeta(lesson: TeacherLessonRow): string {
  const parts = [lessonLevelLabel(lesson.danceStyle, lesson.level)];
  parts.push(
    lesson.kind === "ongoing"
      ? `持續型 · 已上 ${lesson.taughtCount} 堂`
      : `已上 ${lesson.taughtCount}／${lesson.totalPeriods}`
  );
  if (lesson.status === "inProgress" && lesson.nextStart) {
    parts.push(`下一堂 ${periodLabel(lesson.nextStart)}`);
  }
  return parts.filter(Boolean).join(" · ");
}

const TeacherDetail = ({ id, initialMonth }: { id: number; initialMonth: string }) => {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [lessonTab, setLessonTab] = useState<LessonTab>("inProgress");
  const [formKey, setFormKey] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, isError } = useGetTeacherQuery(
    { id, month },
    { refetchOnMountOrArgChange: true }
  );
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

  const { teacher, stats } = data;
  const archived = Boolean(teacher.archivedAt);
  const lessons = data.lessons.filter((lesson) => lesson.status === lessonTab);
  const activeCount = data.lessons.filter((l) => l.status === "inProgress").length;
  const maxAttendance = Math.max(1, ...data.trend.map((m) => m.attendance));

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
      <div className="w-full max-w-[1120px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5">
        <Link
          href="/teachers"
          className="self-start -ml-1 flex items-center gap-0.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft className="w-4 h-4" />
          老師
        </Link>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:p-6 flex flex-wrap items-center gap-4">
          <TeacherAvatar name={teacher.name} color={teacher.color} size="lg" muted={archived} />
          <div className="flex flex-col gap-2 flex-[1_1_240px] min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{teacher.name}</h1>
              {archived && <StatusTag tone="neutral">已封存</StatusTag>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.danceStyles.map((style) => (
                <span
                  key={style.id}
                  className={`text-xs px-2 py-0.5 rounded-full ${danceStyleMeta(style).badge}`}
                >
                  {style.name}
                </span>
              ))}
              <span className="text-sm text-neutral-500">
                {data.firstTaughtAt ? `${sinceLabel(data.firstTaughtAt)}起 · ` : ""}
                共 {data.lessons.length} 個課程
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFormKey(Date.now())}>
              <Pencil className="size-4" />
              編輯
            </Button>
            {data.lessons.length === 0 ? (
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
              <Button
                variant="secondary"
                title="封存後不會出現在開課的老師選單，舊課照常顯示"
                onClick={() => setArchived(true)}
              >
                <Archive className="size-4" />
                封存
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">每月數字</h2>
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>

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

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
            <section className={section}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">課程</h3>
                <SegmentedTabs<LessonTab>
                  ariaLabel="課程狀態"
                  value={lessonTab}
                  onChange={setLessonTab}
                  options={[
                    { value: "inProgress", label: "進行中", hint: activeCount },
                    { value: "finished", label: "已結束", hint: data.lessons.length - activeCount },
                  ]}
                />
              </div>
              {lessons.length === 0 ? (
                <EmptyState
                  kind="inline"
                  title={lessonTab === "inProgress" ? "目前沒有進行中的課。新增課程時就能指定這位老師。" : "還沒有結束的課。"}
                />
              ) : (
                <ul className="flex flex-col">
                  {lessons.map((lesson) => (
                    <li key={lesson.id} className="border-t border-neutral-100 first:border-t-0">
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="flex items-center gap-3 py-3 hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
                      >
                        <span className={`w-1.5 h-10 rounded-full shrink-0 ${danceStyleMeta(lesson.danceStyle).dot}`} />
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="font-medium truncate">{lesson.name}</span>
                          <span className="text-xs text-neutral-500 truncate">{lessonMeta(lesson)}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-semibold tabular-nums">{lesson.avgAttendance ?? "–"}</span>
                          <span className="text-xs text-neutral-500">平均人次</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={section}>
              <h3 className="font-semibold">{monthLabel(month)}的時段</h3>
              {data.periods.length === 0 ? (
                <EmptyState kind="inline" title="這個月沒有排課。" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-neutral-500">
                        <th className="py-2 pr-3 font-medium">時間</th>
                        <th className="py-2 pr-3 font-medium">課程</th>
                        <th className="py-2 pr-3 font-medium text-right">出席</th>
                        <th className="py-2 font-medium text-right">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods.map((period) => {
                        const state = PERIOD_STATE[period.state];
                        return (
                          <tr key={period.id} className="border-t border-neutral-100">
                            <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{periodLabel(period.startTime)}</td>
                            <td className="py-2.5 pr-3">
                              <Link href={`/lessons/${period.lessonId}`} className="hover:underline">
                                {period.lessonName}
                              </Link>
                            </td>
                            <td className="py-2.5 pr-3 text-right tabular-nums">
                              {period.state === "done" ? period.attendance : "–"}
                            </td>
                            <td className="py-2.5 text-right">
                              <StatusTag tone={state.tone}>{state.label}</StatusTag>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-5">
            <section className={section}>
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

            <section className={section}>
              <h3 className="font-semibold">常來的學生</h3>
              {data.regulars.length === 0 ? (
                <EmptyState kind="inline" title="近 6 個月還沒有點名紀錄。" />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.regulars.map((student) => (
                    <li key={student.id}>
                      <Link
                        href={studentDetailHref(student.id, `/teachers/${teacher.id}`)}
                        className="flex items-center gap-3 hover:bg-neutral-50 -mx-2 px-2 py-1 rounded-lg"
                      >
                        <Image
                          src={student.avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded-full shrink-0"
                        />
                        <span className="flex-1 truncate text-sm">{student.name}</span>
                        <span className="text-sm text-neutral-500 tabular-nums">{student.count} 堂</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-neutral-500">以近 6 個月點過名的時段計算。</p>
            </section>

            <section className={section}>
              <h3 className="font-semibold">備註</h3>
              {teacher.note ? (
                <p className="text-sm whitespace-pre-line leading-relaxed">{teacher.note}</p>
              ) : (
                <Button variant="link" onClick={() => setFormKey(Date.now())} className="self-start text-sm">
                  ＋ 加上備註（例如可排課的時段）
                </Button>
              )}
            </section>
          </div>
        </div>
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

/** The detail page's shape while loading: back link is real, the rest mirrors the loaded layout. */
const TeacherDetailSkeleton = () => (
  <div className="w-full max-w-[1120px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5" aria-busy="true">
    <Link
      href="/teachers"
      className="self-start -ml-1 flex items-center gap-0.5 text-sm text-neutral-500 hover:text-neutral-900"
    >
      <ChevronLeft className="w-4 h-4" />
      老師
    </Link>
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:p-6 flex flex-wrap items-center gap-4">
      <Skeleton className="size-16 shrink-0" />
      <div className="flex flex-col gap-2.5 flex-[1_1_240px]">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
    </div>
    <h2 className="text-lg font-semibold">每月數字</h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
    <section className={section}>
      <h3 className="font-semibold">課程</h3>
      {["w-40", "w-28", "w-36"].map((width, i) => (
        <div key={i} className={`flex items-center gap-3 py-3 ${i === 2 ? "opacity-50" : ""}`}>
          <Skeleton className="w-1.5 h-10 shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className={`h-4 ${width}`} />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-8" />
        </div>
      ))}
    </section>
  </div>
);

export default TeacherDetail;
