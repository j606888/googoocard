"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import SegmentedTabs from "@/components/SegmentedTabs";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTeachersOverviewQuery, type TeacherOverviewRow } from "@/store/slices/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import { isAdminRole } from "@/lib/roles";
import InviteDrawer from "@/features/teams/TeamList/InviteDrawer";
import TeacherForm from "./TeacherForm";
import TeacherRow from "./TeacherRow";

type Tab = "active" | "archived";

const SHELL = "flex w-full flex-col px-5 pt-4 pb-10 lg:max-w-[1180px] lg:px-12 lg:pt-9";

/**
 * 老師頁：會教課的人，每人一列——是誰、教哪些課、有沒有帳號。
 * 不包框、不放表頭（去框線改版）；列與列之間一條細線。
 */
const TeacherList = () => {
  const [tab, setTab] = useState<Tab>("active");
  const [formKey, setFormKey] = useState<number | null>(null);
  const [inviting, setInviting] = useState<TeacherOverviewRow | null>(null);
  const { data: memberships } = useGetMembershipsQuery();
  const { data: me } = useGetMeQuery();
  const { data: locationData } = useGetLocationsQuery();
  const isAdmin = isAdminRole(memberships?.find((m) => m.userId === me?.id)?.role);
  const showLocation = (locationData?.locations ?? []).filter((l) => !l.archivedAt).length >= 2;
  // 上課中／每堂課的時段 depend on the clock, and lesson edits elsewhere don't
  // invalidate this — refetch whenever the page is opened.
  const { data, isLoading, isError, refetch } = useGetTeachersOverviewQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  if (isError && !data) {
    return (
      <div className="px-5 py-10 text-center text-ink-3">
        讀取失敗。
        <Button variant="link" onClick={refetch} className="underline">
          再試一次
        </Button>
      </div>
    );
  }

  const active = data?.teachers.filter((t) => !t.archivedAt) ?? [];
  const archived = data?.teachers.filter((t) => t.archivedAt) ?? [];
  const shown = tab === "active" || archived.length === 0 ? active : archived;
  const uninvited = active.filter((t) => t.userId === null).length;
  const summary = data
    ? [active.length > 0 && `${active.length} 位老師`, uninvited > 0 && `${uninvited} 位還沒邀請`]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <div className={SHELL} aria-busy={isLoading || !data}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-9 text-ink">老師</h1>
            <p className="min-h-5 text-[13px] tabular-nums text-ink-3">{summary}</p>
          </div>
          {/* 老師＝會教課的人，沒帳號也能先建（空殼）；有帳號的成員在團隊頁連過來。 */}
          <Button onClick={() => setFormKey(Date.now())}>
            <Plus className="size-4" />
            新增老師
          </Button>
        </header>

        {!data ? (
          <TeacherListSkeleton />
        ) : (
          <>
            {data.unassignedLessonCount > 0 && (
              <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
                <span className="font-semibold text-warning-800">
                  {data.unassignedLessonCount} 堂進行中的課還沒指定老師
                </span>
                <span>指定後才會列在老師名下。</span>
                <Button asChild variant="text" size="sm">
                  <Link href="/lessons">去課程頁</Link>
                </Button>
              </p>
            )}

            {archived.length > 0 && (
              <SegmentedTabs<Tab>
                ariaLabel="老師狀態"
                value={tab}
                onChange={setTab}
                className="mt-5 self-start"
                options={[
                  { value: "active", label: "在職中", hint: active.length },
                  { value: "archived", label: "已封存", hint: archived.length },
                ]}
              />
            )}

            {shown.length === 0 ? (
              <EmptyState
                kind="page"
                pose="proud"
                title="還沒有老師"
                description="先新增老師，開課時才能指定誰來教。"
              />
            ) : (
              <ul
                aria-label={shown === archived ? "已封存的老師" : "在職中的老師"}
                className="mt-4 divide-y divide-line border-b border-line"
              >
                {shown.map((teacher) => (
                  <TeacherRow
                    key={teacher.id}
                    teacher={teacher}
                    showLocation={showLocation}
                    isMe={teacher.userId !== null && teacher.userId === me?.id}
                    onInvite={isAdmin ? () => setInviting(teacher) : undefined}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {formKey !== null && <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />}
      {inviting && <InviteDrawer key={inviting.id} open person={inviting} onClose={() => setInviting(null)} />}
    </>
  );
};

/** List rows while loading; the page header above is real. */
const TeacherListSkeleton = () => (
  <ul className="mt-4 divide-y divide-line">
    {["w-24", "w-20", "w-28", "w-16"].map((width, i) => (
      <li key={i} className={`flex items-center gap-3 py-3 ${i === 3 ? "opacity-50" : ""}`}>
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className={`h-4 ${width}`} />
          <Skeleton className="h-3 w-40" />
        </div>
      </li>
    ))}
  </ul>
);

export default TeacherList;
