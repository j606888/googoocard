"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { type EnrollmentRoster, Lesson, useGetLessonEnrollmentsQuery } from "@/store/slices/lessons";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
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
const TermRoster = ({ lesson }: { lesson: Lesson }) => {
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
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-bold text-neutral-900">整期名單</h3>
          <p className="text-[13px] text-neutral-600">
            整期 ${formatMoney(data.termPrice)} / {data.termSessions} 堂・{enrollments.length} 人報名
            {enrollments.length > 0 && <span className="tabular-nums">・共 ${formatMoney(total)}</span>}
            {unpaid.length > 0 && <span className="text-warning-900">・{unpaid.length} 人還沒收錢</span>}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setRegistering(true)}>
          <Plus className="size-4" />
          登記整期
        </Button>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          kind="inline"
          title="還沒有人報整期"
          description="登記之後，點名時他們會自動勾好、不扣課卡；沒來的可以標請假。"
        />
      ) : (
        <>
          <ul className="flex flex-col">
            {enrollments.map((e) => (
              <li key={e.id} className="-mx-2 flex items-center gap-3 rounded-lg border-b border-neutral-100 px-2 py-2.5 last:border-b-0">
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
