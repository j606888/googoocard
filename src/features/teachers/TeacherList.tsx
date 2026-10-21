"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, GraduationCap, Plus } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useGetTeachersOverviewQuery } from "@/store/slices/teachers";
import MonthSwitcher from "./MonthSwitcher";
import StatTile from "./StatTile";
import TeacherForm from "./TeacherForm";
import TeacherOverviewCard from "./TeacherOverviewCard";
import { currentMonthKey } from "./format";

type Tab = "active" | "archived";

const TeacherList = () => {
  const [month, setMonth] = useState(currentMonthKey);
  const [tab, setTab] = useState<Tab>("active");
  const [formKey, setFormKey] = useState<number | null>(null);
  // Attendance taken elsewhere changes every number here, and nothing on this
  // page would invalidate it — refetch whenever the page or month is opened.
  const { data, isLoading, isError, refetch } = useGetTeachersOverviewQuery(
    { month },
    { refetchOnMountOrArgChange: true }
  );

  if (isError && !data) {
    return (
      <div className="px-5 py-10 text-center text-neutral-500">
        讀取失敗。
        <button type="button" onClick={refetch} className="text-primary-700 underline cursor-pointer">
          再試一次
        </button>
      </div>
    );
  }
  if (isLoading || !data) return <ListSkeleton />;

  const active = data.teachers.filter((t) => !t.archivedAt);
  const archived = data.teachers.filter((t) => t.archivedAt);
  const shown = tab === "active" || archived.length === 0 ? active : archived;
  const { totals } = data;

  return (
    <>
      <div className="w-full max-w-6xl px-5 py-4 lg:px-8 lg:py-8 flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">老師</h2>
            <p className="text-sm text-neutral-500">
              誰在教哪些課、這個月上了幾堂、來了多少學生。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MonthSwitcher month={month} onChange={setMonth} />
            <button
              type="button"
              onClick={() => setFormKey(Date.now())}
              className="bg-primary-500 text-white h-10 px-4 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">新增老師</span>
            </button>
          </div>
        </div>

        {data.unassignedLessonCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-warning-800 shrink-0" />
            <p className="flex-1 min-w-[14rem] text-sm text-warning-900">
              <strong>{data.unassignedLessonCount} 堂進行中的課還沒指定老師</strong>
              ——指定後才會算進老師的堂數與出席人次。
            </p>
            <Link href="/lessons" className="text-sm font-semibold text-warning-900 underline-offset-2 hover:underline">
              去課程頁 →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="授課老師"
            value={active.length}
            unit="位"
            hint={archived.length > 0 ? `另有 ${archived.length} 位已封存` : undefined}
          />
          <StatTile label="本月已上" value={totals.sessions} unit="堂" />
          <StatTile label="本月出席" value={totals.attendance} unit="人次" />
          <StatTile
            label="時段過了還沒點名"
            value={totals.pendingCount}
            unit="堂"
            tone={totals.pendingCount > 0 ? "warning" : "default"}
          />
        </div>

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
          <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-lg font-bold">還沒有老師</p>
              <p className="text-sm text-neutral-500 text-center">
                先新增老師，開課時才能指定誰來教。
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {shown.map((teacher) => (
              <TeacherOverviewCard
                key={teacher.id}
                teacher={teacher}
                month={month}
                months={data.months}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-neutral-500 leading-relaxed">
          堂數與出席人次只算已點名的時段；學生自助簽到要等老師點名定案後才會算進來。一堂課有兩位老師時，兩位都會算到。
        </p>
      </div>

      {formKey !== null && (
        <TeacherForm key={formKey} open onClose={() => setFormKey(null)} />
      )}
    </>
  );
};

export default TeacherList;
