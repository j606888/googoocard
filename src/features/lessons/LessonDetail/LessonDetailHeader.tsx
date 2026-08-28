"use client";

import Link from "next/link";
import { ArrowLeft, Users, BookOpenText, GraduationCap, Settings } from "lucide-react";
import { Lesson, LessonStudent } from "@/store/slices/lessons";
import { DANCE_TYPE_META } from "@/lib/danceTypes";
import UnpaidBell from "@/features/UnpaidBell";

const LessonDetailHeader = ({
  lesson,
  students,
  showSettings,
  onToggleSettings,
}: {
  lesson: Lesson;
  students: LessonStudent[];
  showSettings: boolean;
  onToggleSettings: () => void;
}) => {
  const style = DANCE_TYPE_META[lesson.danceType];
  const periods = lesson.periods || [];
  const attendedCount = periods.filter((p) => p.attendanceTakenAt).length;
  const totalAttendances = students.reduce(
    (sum, s) => sum + s.attendances.filter((a) => a.attendanceStatus === "attended").length,
    0
  );
  const totalPossible = students.length * periods.length;
  const attendanceRate = totalPossible > 0 ? Math.round((totalAttendances / totalPossible) * 100) : 0;

  const isFinished = periods.length > 0 && attendedCount === periods.length;

  return (
    <div className={`hidden lg:block border-b border-neutral-200 px-8 py-5 ${style.light}`}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
        <Link href="/lessons" className="flex items-center gap-1 hover:text-neutral-700">
          <ArrowLeft className="w-4 h-4" />
          <span>課程</span>
        </Link>
        {lesson.group && (
          <>
            <span>/</span>
            <Link href={`/lessons/groups/${lesson.group.id}`} className="hover:text-neutral-700">
              {lesson.group.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-neutral-700 font-medium truncate max-w-xs">{lesson.name}</span>
      </div>

      {/* Title + badges */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${style.bg}`}>
          {lesson.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{lesson.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
              {lesson.danceType}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isFinished ? "bg-neutral-100 text-neutral-600" : "bg-primary-100 text-primary-700"}`}>
              {isFinished ? "已結束" : "上課中"}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              showSettings
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            編輯
          </button>
          <UnpaidBell />
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200 shadow-sm">
          <Users className="w-4 h-4" />
          <span>{lesson.students.length} 位學生</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200 shadow-sm">
          <BookOpenText className="w-4 h-4" />
          <span>{attendedCount} / {periods.length} 個時段</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200 shadow-sm">
          <span className={`w-2 h-2 rounded-full ${attendanceRate >= 80 ? "bg-primary-500" : attendanceRate >= 50 ? "bg-warning-500" : "bg-neutral-400"}`} />
          <span>出席率 {attendanceRate}%</span>
        </div>
        {lesson.teachers.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200 shadow-sm">
            <GraduationCap className="w-4 h-4" />
            <span>{lesson.teachers.map((t) => t.name).join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonDetailHeader;
