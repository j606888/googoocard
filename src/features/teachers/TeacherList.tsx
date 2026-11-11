"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import SegmentedTabs from "@/components/SegmentedTabs";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTeachersOverviewQuery, type TeacherOverviewRow } from "@/store/slices/teachers";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import { isAdminRole } from "@/lib/roles";
import InviteDrawer from "@/features/teams/TeamList/InviteDrawer";
import TeacherForm from "./TeacherForm";
import TeacherRow, { TEACHER_ROW_COLUMNS } from "./TeacherRow";

type Tab = "active" | "archived";

const TeacherList = () => {
  const [tab, setTab] = useState<Tab>("active");
  const [formKey, setFormKey] = useState<number | null>(null);
  const [inviting, setInviting] = useState<TeacherOverviewRow | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: memberships } = useGetMembershipsQuery();
  const { data: me } = useGetMeQuery();
  const isAdmin = isAdminRole(memberships?.find((m) => m.userId === me?.id)?.role);
  const memberByUser = new Map((memberships ?? []).map((m) => [m.userId, m]));
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
      </div>
      {/* 老師＝會教課的人，沒帳號也能先建（空殼）；有帳號的成員在團隊頁連過來。 */}
      <Button onClick={() => setFormKey(Date.now())}>
        <Plus className="size-4" />
        新增老師
      </Button>
    </div>
  );

  if (isLoading || !data) {
    return (
      <>
        <div className="w-full max-w-[1040px] px-5 py-4 lg:px-8 lg:py-6 flex flex-col gap-5" aria-busy="true">
          {header}
          <TeacherListSkeleton />
        </div>
        {formKey !== null && <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />}
      </>
    );
  }

  const active = data.teachers.filter((t) => !t.archivedAt);
  const archived = data.teachers.filter((t) => t.archivedAt);
  const shown = tab === "active" || archived.length === 0 ? active : archived;

  return (
    <>
      <div className="w-full max-w-[1040px] px-5 py-4 lg:px-8 lg:py-6 flex flex-col gap-5">
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
          <section className="flex flex-col">
            <div
              className={`hidden rounded-t-2xl border border-b-0 border-neutral-200 bg-neutral-50 px-5 py-2.5 text-xs text-neutral-500 ${TEACHER_ROW_COLUMNS}`}
            >
              <span>老師</span>
              <span>下一堂</span>
              <span>進行中</span>
              <span>帳號</span>
              <span />
            </div>
            <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white lg:rounded-t-none">
              {shown.map((teacher) => {
                const member = teacher.userId !== null ? memberByUser.get(teacher.userId) : undefined;
                const accountLabel =
                  teacher.userId === null
                    ? null
                    : teacher.userId === me?.id
                      ? "你"
                      : (member?.user.email ?? "已連結帳號");
                return (
                  <TeacherRow
                    key={teacher.id}
                    teacher={teacher}
                    open={openId === teacher.id}
                    onToggle={() => setOpenId(openId === teacher.id ? null : teacher.id)}
                    accountLabel={accountLabel}
                    onInvite={isAdmin ? () => setInviting(teacher) : undefined}
                  />
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {formKey !== null && <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />}
      {inviting && <InviteDrawer key={inviting.id} open person={inviting} onClose={() => setInviting(null)} />}
    </>
  );
};

/** List rows while loading; the page header above is real. */
const TeacherListSkeleton = () => (
  <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
    {["w-24", "w-20", "w-28", "w-16"].map((width, i) => (
      <li key={i} className={`flex items-center gap-3 px-5 py-3.5 ${i === 3 ? "opacity-50" : ""}`}>
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className={`h-4 ${width}`} />
          <Skeleton className="h-3 w-32" />
        </div>
      </li>
    ))}
  </ul>
);

export default TeacherList;
