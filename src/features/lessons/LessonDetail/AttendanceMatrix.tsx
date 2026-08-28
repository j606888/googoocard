"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Period, LessonStudent } from "@/store/slices/lessons";
import { studentDetailHref } from "@/lib/studentNav";

const STATUS_DOT: Record<string, string> = {
  attended: "bg-primary-500",
  absent: "bg-danger-400",
  not_started: "bg-neutral-200",
};

const STATUS_LABEL: Record<string, string> = {
  attended: "已出席",
  absent: "缺席",
  not_started: "尚未點名",
};

const AttendanceMatrix = ({
  periods,
  students,
}: {
  periods: Period[];
  students: LessonStudent[];
}) => {
  const pathname = usePathname();
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const totalAttended = students.reduce(
    (sum, s) => sum + s.attendances.filter((a) => a.attendanceStatus === "attended").length,
    0
  );
  const totalCells = students.length * sortedPeriods.length;
  const rate = totalCells > 0 ? Math.round((totalAttended / totalCells) * 100) : 0;

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-neutral-400 gap-2">
        <span className="text-4xl">📋</span>
        <p className="text-sm">還沒有學生加入這門課</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-neutral-800">出席總覽</h3>
        <span className="text-sm text-neutral-500">{sortedPeriods.length} 個時段</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-neutral-50">
              <th className="sticky left-0 bg-neutral-50 z-10 text-left px-4 py-3 font-medium text-neutral-600 border-b border-r border-neutral-200 w-44 min-w-44">
                學生
              </th>
              {sortedPeriods.map((p) => (
                <th
                  key={p.id}
                  className="px-2 py-3 text-center font-medium text-neutral-500 border-b border-neutral-200 min-w-12"
                >
                  <div className="text-xs">{format(new Date(p.startTime), "M/d")}</div>
                  <div className="text-xs text-neutral-400">{format(new Date(p.startTime), "EEE", { locale: zhTW })}</div>
                  {p.attendanceTakenAt && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mx-auto mt-1" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, i) => {
              const attendedForStudent = student.attendances.filter((a) => a.attendanceStatus === "attended").length;
              return (
                <tr key={student.id} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}>
                  <td className="sticky left-0 z-10 px-4 py-3 border-r border-neutral-200 font-medium" style={{ backgroundColor: i % 2 === 0 ? "white" : "rgb(249 250 251 / 0.5)" }}>
                    <div className="flex items-center gap-2">
                      <Link
                        href={studentDetailHref(student.id, pathname)}
                        className="text-neutral-800 hover:text-primary-600 truncate max-w-32 block"
                      >
                        {student.name}
                      </Link>
                      <span className="text-xs text-neutral-400 shrink-0">{attendedForStudent}/{sortedPeriods.length}</span>
                    </div>
                  </td>
                  {sortedPeriods.map((p) => {
                    const attendance = student.attendances.find(
                      (a) => a.startTime === p.startTime
                    );
                    const status = attendance?.attendanceStatus ?? "not_started";
                    const label = STATUS_LABEL[status];
                    return (
                      <td key={p.id} className="px-2 py-3 text-center">
                        <div
                          className={`w-5 h-5 rounded-full mx-auto ${STATUS_DOT[status]}`}
                          title={`${student.name} — ${format(new Date(p.startTime), "M月d日")}: ${label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary-500" />
            <span>已出席</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger-400" />
            <span>缺席</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-neutral-200 border border-neutral-300" />
            <span>尚未點名</span>
          </div>
        </div>
        <div className="text-xs text-neutral-500">
          共 {totalAttended} / {totalCells} &mdash; <span className="font-semibold text-neutral-700">出席率 {rate}%</span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMatrix;
