"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import SegmentedTabs from "@/components/SegmentedTabs";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTeachersOverviewQuery } from "@/store/slices/teachers";
import TeacherForm from "./TeacherForm";
import TeacherOverviewCard from "./TeacherOverviewCard";

type Tab = "active" | "archived";

const TeacherList = () => {
  const [tab, setTab] = useState<Tab>("active");
  const [formKey, setFormKey] = useState<number | null>(null);
  // 上課中／下一堂 depend on the clock, and lesson edits elsewhere don't
  // invalidate this — refetch whenever the page is opened.
  const { data, isLoading, isError, refetch } = useGetTeachersOverviewQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  if (isError && !data) {
    return (
      <div className="px-5 py-10 text-center text-neutral-500">
        讀取失敗。
        <Button variant="link" onClick={refetch} className="underline">
          再試一次
        </Button>
      </div>
    );
  }
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-neutral-900">老師</h2>
        <p className="text-sm text-neutral-500">
          誰在教哪些課、下一堂是什麼時候。
        </p>
      </div>
      <Button onClick={() => setFormKey(Date.now())}>
        <Plus className="size-4" />
        新增老師
      </Button>
    </div>
  );

  if (isLoading || !data) {
    return (
      <>
        <div className="w-full max-w-[1120px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5" aria-busy="true">
          {header}
          <TeacherListSkeleton />
        </div>
        {formKey !== null && (
          <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />
        )}
      </>
    );
  }

  const active = data.teachers.filter((t) => !t.archivedAt);
  const archived = data.teachers.filter((t) => t.archivedAt);
  const shown = tab === "active" || archived.length === 0 ? active : archived;

  return (
    <>
      <div className="w-full max-w-[1120px] px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5">
        {header}

        {data.unassignedLessonCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-300 bg-warning-50 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-warning-950 shrink-0" />
            <p className="flex-1 min-w-[14rem] text-sm text-warning-950">
              <strong>{data.unassignedLessonCount} 堂進行中的課還沒指定老師</strong>
              ——指定後才會出現在老師的卡片上。
            </p>
            <Link href="/lessons" className="text-sm font-semibold text-warning-950 underline-offset-4 hover:underline">
              去課程頁 →
            </Link>
          </div>
        )}

        {archived.length > 0 && (
          <SegmentedTabs<Tab>
            ariaLabel="老師狀態"
            value={tab}
            onChange={setTab}
            className="self-start"
            options={[
              { value: "active", label: "在職中", hint: active.length },
              { value: "archived", label: "已封存", hint: archived.length },
            ]}
          />
        )}

        {active.length === 0 && tab === "active" ? (
          <EmptyState
            kind="page"
            title="還沒有老師"
            description="先新增老師，開課時才能指定誰來教。"
          />
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {shown.map((teacher) => (
              <TeacherOverviewCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        )}
      </div>

      {formKey !== null && (
        <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />
      )}
    </>
  );
};

/** Overview cards while loading; the page header above is real. */
const TeacherListSkeleton = () => (
  <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
    {["", "", "opacity-50"].map((fade, i) => (
      <div key={i} className={`rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-4 ${fade}`}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className={`h-4 ${i === 1 ? "w-20" : "w-28"}`} />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    ))}
  </div>
);

export default TeacherList;
