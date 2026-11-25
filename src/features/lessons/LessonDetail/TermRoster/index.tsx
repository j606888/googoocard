"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  type EnrollmentRoster,
  type TermAttendanceStatus,
  Lesson,
  useGetLessonEnrollmentsQuery,
} from "@/store/slices/lessons";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import InfoTip from "@/components/InfoTip";
import StatusTag from "@/components/StatusTag";
import ConfirmPaymentDrawer, { type ConfirmPaymentTarget } from "@/features/students/ConfirmPaymentDrawer";
import EnrollmentDrawer from "./EnrollmentDrawer";
import TermProgress from "./TermProgress";
import { TERM_STATUS_META } from "./termStatus";

type Enrollment = EnrollmentRoster["enrollments"][number];

/**
 * 整期名單（只在開了報名整期的課出現）：老師登記、記收款；每人一排出缺勤格子，
 * 請假／曠課一眼看得到。收入照整期每堂攤，跟有沒有來無關。
 */
const PAYMENT_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

/** 表格裡一格出缺勤：有來 ●、請假「假」、曠課 ✕、還沒上 ○。 */
const STATUS_CELL: Record<TermAttendanceStatus, { mark: string; className: string }> = {
  present: { mark: "●", className: "text-primary-700" },
  leave: { mark: "假", className: "text-warning-800 font-semibold" },
  absent: { mark: "✕", className: "text-danger-700 font-semibold" },
  upcoming: { mark: "○", className: "text-neutral-300" },
  outside: { mark: "", className: "" },
};

const TermRoster = ({ lesson, variant = "list" }: { lesson: Lesson; variant?: "list" | "table" }) => {
  const offered = lesson.termPrice != null && lesson.termSessions != null;
  const { data } = useGetLessonEnrollmentsQuery({ id: lesson.id }, { skip: !offered });
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [paying, setPaying] = useState<ConfirmPaymentTarget | null>(null);

  if (!offered || !data || data.termPrice === null || data.termSessions === null) return null;

  const { enrollments } = data;
  const unpaid = enrollments.filter((e) => !e.isPaid);
  const total = enrollments.reduce((sum, e) => sum + e.price, 0);
  const firstPeriodTaken = data.periods[0]?.attendanceTaken ?? false;

  return (
    <section className={`flex flex-col gap-2 ${variant === "table" ? "" : "border-b border-line pb-6"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-1 text-[17px] font-semibold text-ink lg:text-base">
            整期名單
            <InfoTip label="整期名單說明">登記之後，點名時會標「預計今天會到」、不扣課卡；沒來的可以標請假。</InfoTip>
          </h3>
          <p className="text-[13px] text-ink-3">
            整期 ${formatMoney(data.termPrice)} / {data.termSessions} 堂・{enrollments.length} 人報名
            {enrollments.length > 0 && <span className="tabular-nums">・共 ${formatMoney(total)}</span>}
            {unpaid.length > 0 && <span className="text-warning-900">・{unpaid.length} 人還沒收錢</span>}
          </p>
        </div>
        <Button type="button" variant="text" size="sm" onClick={() => setRegistering(true)}>
          <Plus className="size-4" />
          登記整期
        </Button>
      </div>

      {enrollments.length === 0 ? (
        <p className="text-[13px] text-ink-3">還沒有人報整期</p>
      ) : variant === "table" ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-ink-3">
                  <th className="h-10 pr-3 font-normal">學生</th>
                  {data.periods.slice(0, data.termSessions ?? undefined).map((p) => (
                    <th key={p.id} className="h-10 w-14 text-center font-normal tabular-nums">
                      {format(new Date(p.startTime), "M/d")}
                    </th>
                  ))}
                  <th className="h-10 w-24 pr-3 text-right font-normal">價格</th>
                  <th className="h-10 w-48 px-3 font-normal">付款</th>
                  <th className="h-10 font-normal">備註</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id} className="border-b border-line hover:bg-surface">
                    <td className="h-12 pr-3">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="flex cursor-pointer items-center gap-2.5 text-left font-medium text-ink hover:text-primary-800"
                      >
                        <img src={e.student.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                        {e.student.name}
                      </button>
                    </td>
                    {data.periods.slice(0, data.termSessions ?? undefined).map((p, index) => {
                      const cell = STATUS_CELL[e.statuses[index] ?? "upcoming"];
                      return (
                        <td key={p.id} className={`h-12 text-center ${cell.className}`} title={TERM_STATUS_META[e.statuses[index] ?? "upcoming"].label}>
                          {cell.mark}
                        </td>
                      );
                    })}
                    <td className="h-12 pr-3 text-right tabular-nums">${formatMoney(e.price)}</td>
                    <td className="h-12 px-3">
                      {e.isPaid ? (
                        <span className="text-ink-2">
                          已付
                          {e.paymentMethod && ` · ${PAYMENT_LABEL[e.paymentMethod]}`}
                          {e.paymentReference && ` ${e.paymentReference}`}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer font-semibold text-danger-700 hover:underline"
                          onClick={() =>
                            setPaying({
                              studentId: e.student.id,
                              studentCardId: 0,
                              enrollmentId: e.id,
                              studentName: e.student.name,
                              cardName: `${lesson.name} 整期`,
                              finalPrice: e.price,
                            })
                          }
                        >
                          未付，記收款
                        </button>
                      )}
                    </td>
                    <td className="h-12 max-w-72 truncate text-ink-3" title={e.note ?? undefined}>
                      {e.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">● 有來　假 請假　✕ 曠課　○ 還沒上 · 點名字可以改價格或備註</p>
        </>
      ) : (
        <>
          <ul className="flex flex-col">
            {enrollments.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <img src={e.student.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-semibold">{e.student.name}</span>
                      {(e.price !== data.termPrice || e.sessions !== data.termSessions) && (
                        <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                          ${formatMoney(e.price)} / {e.sessions} 堂
                        </span>
                      )}
                    </span>
                    <TermProgress statuses={e.statuses} total={e.sessions} className="max-w-48" />
                  </span>
                </button>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {!e.isPaid ? (
                    <button
                      type="button"
                      className="cursor-pointer"
                      onClick={() =>
                        setPaying({
                          studentId: e.student.id,
                          studentCardId: 0,
                          enrollmentId: e.id,
                          studentName: e.student.name,
                          cardName: `${lesson.name} 整期`,
                          finalPrice: e.price,
                        })
                      }
                    >
                      <StatusTag tone="danger">未付 ${formatMoney(e.price)}</StatusTag>
                    </button>
                  ) : e.counts.absent > 0 ? (
                    <StatusTag tone="danger">曠課 {e.counts.absent}</StatusTag>
                  ) : e.counts.leave > 0 ? (
                    <StatusTag tone="warning">請假 {e.counts.leave}</StatusTag>
                  ) : (
                    <StatusTag tone="positive">已付</StatusTag>
                  )}
                  {e.isPaid && e.counts.absent > 0 && e.counts.leave > 0 && (
                    <span className="text-xs text-neutral-500">請假 {e.counts.leave}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            {(["present", "leave", "absent", "upcoming"] as const).map((status) => (
              <span key={status} className="flex items-center gap-1">
                <span className={`inline-block h-1.5 w-3 rounded-full ${TERM_STATUS_META[status].className}`} />
                {TERM_STATUS_META[status].label}
              </span>
            ))}
          </p>
        </>
      )}

      {registering && (
        <EnrollmentDrawer
          lessonId={lesson.id}
          termPrice={data.termPrice}
          termSessions={data.termSessions}
          enrolledStudentIds={enrollments.map((e) => e.student.id)}
          firstPeriodTaken={firstPeriodTaken}
          onClose={() => setRegistering(false)}
        />
      )}
      {editing && (
        <EnrollmentDrawer
          lessonId={lesson.id}
          termPrice={data.termPrice}
          termSessions={data.termSessions}
          enrolledStudentIds={[]}
          firstPeriodTaken={firstPeriodTaken}
          enrollment={editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmPaymentDrawer target={paying} onClose={() => setPaying(null)} />
    </section>
  );
};

export default TermRoster;
