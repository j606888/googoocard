"use client";

import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import { CreditCard, AlertCircle, Tag } from "lucide-react";
import DanceBadge from "./DanceBadge";

const tagStyle = (name: string) =>
  name === "Needs Renewal"
    ? "text-red-700 bg-red-100"
    : "text-gray-600 bg-gray-100";

const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();
  const studentCards = student.studentCards;
  const activeCards = studentCards.filter((c) => c.remainingSessions > 0);
  const firstTag = student.tags?.[0];

  return (
    <div
      className="cursor-pointer"
      onClick={() => router.push(`/students/${student.id}`)}
    >
      {/* Mobile layout */}
      <div className="lg:hidden flex items-center gap-3 py-2 px-1 border-b border-gray-100 hover:bg-gray-50">
        <img
          src={student.avatarUrl}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex flex-1 items-center justify-between min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-medium">{student.name}</h2>
              {student.note && (
                <p className="text-sm text-gray-500">({student.note})</p>
              )}
              {firstTag && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagStyle(firstTag.name)}`}>
                  {firstTag.name}
                </span>
              )}
            </div>
            <p className="flex gap-1 items-center text-sm text-gray-400">
              <CreditCard className="w-4 h-4" />
              {studentCards.length}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-1">
            {student.hasCompletedBachataLv1 && <DanceBadge type="bachata" />}
            {student.hasCompletedSalsaLv1 && <DanceBadge type="salsa" />}
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex lg:items-center lg:gap-4 lg:border lg:border-gray-200 lg:rounded-xl lg:p-4 lg:hover:shadow-md lg:hover:border-gray-300 lg:transition-all lg:duration-200 lg:bg-white lg:hover:bg-gray-50">
        <img
          src={student.avatarUrl}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex flex-1 items-center justify-between min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900">{student.name}</h2>
              {student.note && (
                <p className="text-sm text-gray-500 truncate max-w-40">({student.note})</p>
              )}
              {firstTag && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tagStyle(firstTag.name)}`}>
                  {firstTag.name === "Needs Renewal" ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Tag className="w-3 h-3" />
                  )}
                  {firstTag.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                {studentCards.length} cards
              </span>
              {activeCards.length > 0 && (
                <span className="text-primary-600 font-medium">
                  {activeCards.length} active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {student.hasCompletedBachataLv1 && <DanceBadge type="bachata" />}
            {student.hasCompletedSalsaLv1 && <DanceBadge type="salsa" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleStudent;
