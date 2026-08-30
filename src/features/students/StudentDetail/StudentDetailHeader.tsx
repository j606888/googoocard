"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  BookOpenText,
  Star,
  AlertCircle,
  Tag,
  ExternalLink,
} from "lucide-react";
import { StudentWithDetail } from "@/store/slices/students";
import { format } from "date-fns";
import EditStudent from "./BasicSection/EditStudent";
import { danceTypeLabel } from "@/lib/danceTypes";

const StudentDetailHeader = ({
  student,
  backHref = "/students",
  variant = "page",
  fullHref,
}: {
  student: StudentWithDetail;
  backHref?: string;
  /**
   * "page" —— 獨立學生頁的頁首（含麵包屑，只在桌面顯示）。
   * "pane" —— 分割檢視右欄的頁首：沒有麵包屑（左邊名單一直在），
   *           改成「完整頁面」出口，深度操作仍回到三欄頁。
   */
  variant?: "page" | "pane";
  /** variant="pane" 時「完整頁面」要去的網址 */
  fullHref?: string;
}) => {
  const isPane = variant === "pane";
  const activeCards = student.studentCards.filter((c) => c.remainingSessions > 0);
  const lastAttend = student.overview.lastAttendAt
    ? format(new Date(student.overview.lastAttendAt), "yyyy年M月d日")
    : "尚未上課";

  return (
    <div
      className={
        isPane
          ? "flex-none border-b border-neutral-200 px-6 py-4 bg-white"
          : "hidden lg:block border-b border-neutral-200 px-8 py-5 bg-white"
      }
    >
      {/* Breadcrumb — 分割檢視不需要，左邊名單就是返回路徑 */}
      {!isPane && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
          <Link href={backHref} className="flex items-center gap-1 hover:text-neutral-700">
            <ArrowLeft className="w-4 h-4" />
            <span>學生</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">{student.name}</span>
        </div>
      )}

      {/* Title row */}
      <div className={`flex items-center gap-4 ${isPane ? "mb-3" : "mb-4"}`}>
        <img
          src={student.avatarUrl}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-primary-100 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-neutral-900">{student.name}</h1>
            <span className="text-sm font-mono text-neutral-400">#{student.number}</span>
            {student.note && (
              <span className="text-sm text-neutral-500">({student.note})</span>
            )}
            {student.tags?.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  tag.name === "Needs Renewal"
                    ? "text-danger-700 bg-danger-100"
                    : "text-neutral-600 bg-neutral-100"
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
            {student.danceQualifications?.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 text-xs font-medium bg-warning-100 text-warning-900 px-2.5 py-1 rounded-full"
              >
                <Star className="w-3 h-3" />
                {danceTypeLabel(type)} Lv1
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <EditStudent student={student} />
          {isPane && fullHref && (
            <Link
              href={fullHref}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              完整頁面
            </Link>
          )}
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200">
          <BookOpenText className="w-4 h-4" />
          <span>上過 {student.overview.attendLessonCount} 堂課</span>
        </div>
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200">
          <CreditCard className="w-4 h-4" />
          <span>共 {student.overview.cardCount} 張課卡</span>
          {activeCards.length > 0 && (
            <span className="text-primary-600 font-semibold">（{activeCards.length} 張可用）</span>
          )}
        </div>
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-full text-sm text-neutral-600 border border-neutral-200">
          <span className={`w-2 h-2 rounded-full shrink-0 ${student.overview.lastAttendAt ? "bg-primary-500" : "bg-neutral-300"}`} />
          <span>最近上課：{lastAttend}</span>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailHeader;
