"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, BookOpenText, Star, AlertCircle, Tag } from "lucide-react";
import { StudentWithDetail } from "@/store/slices/students";
import { format } from "date-fns";
import EditStudent from "./BasicSection/EditStudent";

const StudentDetailHeader = ({
  student,
}: {
  student: StudentWithDetail;
}) => {
  const activeCards = student.studentCards.filter((c) => c.remainingSessions > 0);
  const lastAttend = student.overview.lastAttendAt
    ? format(new Date(student.overview.lastAttendAt), "MMM d, yyyy")
    : "No attendance yet";

  return (
    <div className="hidden lg:block border-b border-gray-200 px-8 py-5 bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <Link href="/students" className="flex items-center gap-1 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
          <span>Students</span>
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{student.name}</span>
      </div>

      {/* Title row */}
      <div className="flex items-center gap-4 mb-4">
        <img
          src={student.avatarUrl}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-primary-100 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            {student.note && (
              <span className="text-sm text-gray-500">({student.note})</span>
            )}
            {student.tags?.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  tag.name === "Needs Renewal"
                    ? "text-red-700 bg-red-100"
                    : "text-gray-600 bg-gray-100"
                }`}
              >
                {tag.name === "Needs Renewal" ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Tag className="w-3 h-3" />
                )}
                {tag.name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {student.hasCompletedBachataLv1 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-warning-100 text-warning-900 px-2.5 py-1 rounded-full">
                <Star className="w-3 h-3" />
                Bachata Lv1
              </span>
            )}
            {student.hasCompletedSalsaLv1 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-warning-100 text-warning-900 px-2.5 py-1 rounded-full">
                <Star className="w-3 h-3" />
                Salsa Lv1
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <EditStudent student={student} />
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-600 border border-gray-200">
          <BookOpenText className="w-4 h-4" />
          <span>{student.overview.attendLessonCount} lessons attended</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-600 border border-gray-200">
          <CreditCard className="w-4 h-4" />
          <span>{student.overview.cardCount} cards total</span>
          {activeCards.length > 0 && (
            <span className="text-primary-600 font-semibold">({activeCards.length} active)</span>
          )}
        </div>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-600 border border-gray-200">
          <span className={`w-2 h-2 rounded-full shrink-0 ${student.overview.lastAttendAt ? "bg-primary-500" : "bg-gray-300"}`} />
          <span>Last seen: {lastAttend}</span>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailHeader;
