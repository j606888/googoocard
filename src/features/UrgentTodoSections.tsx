import type { ReactNode } from "react";
import Link from "next/link";
import CardSerial from "@/components/CardSerial";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import type { Todos, TodoStudent } from "@/store/slices/todos";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { studentDetailHref } from "@/lib/studentNav";
import type { ConfirmPaymentTarget } from "@/features/students/ConfirmPaymentDrawer";
import type { BindCardTarget } from "@/features/BindAttendanceCardDialog";

/** 未付款超過這麼多天就標紅。 */
const UNPAID_OVERDUE_DAYS = 7;

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/**
 * 「要處理」的三類（src/service/todos.ts）：點名沒課卡、買卡未付款、單堂未付——可以就地「補卡」「確認收款」。
 * 待處理鈴鐺與財務首頁共用，同一份資料、同一個處理動作。
 */
export function UrgentTodoSections({
  unboundAttendance,
  unpaidCards,
  unpaidDropIns,
  onNavigate,
  onBind,
  onPay,
}: {
  unboundAttendance: Todos["unboundAttendance"];
  unpaidCards: Todos["unpaidCards"];
  unpaidDropIns: Todos["unpaidDropIns"];
  onNavigate?: () => void;
  onBind: (target: BindCardTarget) => void;
  onPay: (target: ConfirmPaymentTarget) => void;
}) {
  return (
    <>
      <TodoSection title="點名沒課卡" count={unboundAttendance.length} dot="bg-danger-600">
        {unboundAttendance.map((item) => (
          <TodoRow
            key={`unbound-${item.id}`}
            href={`/lessons/${item.lessonId}/periods/${item.lessonPeriodId}/check-success`}
            student={item.student}
            onNavigate={onNavigate}
            subtitle={
              <span className="block truncate">
                {formatDate(item.lessonPeriodStartTime)} {item.lessonName}
                {item.source === "STUDENT" && "（自助簽到）"}
              </span>
            }
            action={
              <Button
                size="sm"
                onClick={() =>
                  onBind({
                    lessonId: item.lessonId,
                    lessonPeriodId: item.lessonPeriodId,
                    lessonName: item.lessonName,
                    lessonPeriodStartTime: item.lessonPeriodStartTime,
                    studentId: item.student.id,
                    studentName: item.student.name,
                  })
                }
              >
                補卡
              </Button>
            }
          />
        ))}
      </TodoSection>

      <TodoSection title="買卡未付款" count={unpaidCards.length} dot="bg-warning-600">
        {unpaidCards.map((item) => {
          const days = daysSince(item.createdAt);
          return (
            <TodoRow
              key={`unpaid-${item.id}`}
              href={studentDetailHref(item.student.id)}
              student={item.student}
              onNavigate={onNavigate}
              tag={
                <StatusTag tone={days > UNPAID_OVERDUE_DAYS ? "danger" : "neutral"}>
                  未付 {days} 天
                </StatusTag>
              }
              subtitle={
                <>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{item.cardName}</span>
                    <CardSerial serialNumber={item.serialNumber} />
                  </span>
                  {item.usedSessions > 0 && (
                    <span className="block text-xs">已用 {item.usedSessions} / {item.totalSessions} 堂</span>
                  )}
                </>
              }
              action={
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-neutral-900">
                    ${formatMoney(item.finalPrice)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      onPay({
                        studentId: item.student.id,
                        studentCardId: item.id,
                        studentName: item.student.name,
                        cardName: item.cardName,
                        serialNumber: item.serialNumber,
                        finalPrice: item.finalPrice,
                      })
                    }
                  >
                    確認收款
                  </Button>
                </div>
              }
            />
          );
        })}
      </TodoSection>

      <TodoSection title="單堂未付" count={unpaidDropIns.length} dot="bg-warning-600">
        {unpaidDropIns.map((item) => (
          <TodoRow
            key={`dropin-${item.id}`}
            href={`/lessons/${item.lessonId}/periods/${item.lessonPeriodId}/check-success`}
            student={item.student}
            onNavigate={onNavigate}
            subtitle={
              <span className="block truncate">
                {formatDate(item.lessonPeriodStartTime)} {item.lessonName}
              </span>
            }
            action={
              <span className="text-sm font-semibold text-neutral-900">${formatMoney(item.amount)}</span>
            }
          />
        ))}
      </TodoSection>
    </>
  );
}

export const TodoSection = ({
  title,
  hint,
  count,
  dot,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  /** 要處理那幾類的色點 */
  dot?: string;
  children: ReactNode;
}) => {
  if (count === 0) return null;
  return (
    <section className="flex flex-col">
      <div className="px-4 pt-3 pb-1">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-600">
          {dot && <span className={`size-2 rounded-full ${dot}`} />}
          {title}（{count}）
        </h3>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
};

export const TodoRow = ({
  href,
  student,
  subtitle,
  tag,
  action,
  onNavigate,
}: {
  href: string;
  student: TodoStudent;
  subtitle: ReactNode;
  /** 名字旁的小標籤（未付 N 天） */
  tag?: ReactNode;
  /** 右側：就地操作的按鈕或狀態 */
  action?: ReactNode;
  onNavigate?: () => void;
}) => (
  <div className="flex gap-3 items-center px-4 py-2 hover:bg-neutral-50">
    <Link href={href} onClick={onNavigate} className="flex flex-1 min-w-0 gap-3 items-center">
      <img
        src={student.avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-neutral-900 truncate">{student.name}</span>
          {tag}
        </span>
        <span className="text-[13px] text-neutral-600 min-w-0">{subtitle}</span>
      </div>
    </Link>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
