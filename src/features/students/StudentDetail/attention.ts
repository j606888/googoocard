import { differenceInCalendarDays } from "date-fns";
import type { StudentWithDetail } from "@/store/slices/students";
import { formatMoney } from "@/lib/money";
import { ACTIVE_DAYS, NEEDS_RENEWAL_TAG } from "../StudentList/studentFilters";

export type Attention =
  | { kind: "unpaid"; message: string; card: StudentWithDetail["studentCards"][number] | null }
  | { kind: "renewal"; message: string }
  | { kind: "idle"; message: string };

/**
 * 這位學生現在最該處理的一件事；沒有就回 null。
 * 一次只講一件，優先順序：未付款 > 需續約 > 有卡沒來。
 */
export function attentionFor(student: StudentWithDetail, now = new Date()): Attention | null {
  const unpaid = student.studentCards.filter((card) => !card.isPaid);
  if (unpaid.length > 0) {
    const total = unpaid.reduce((sum, card) => sum + card.finalPrice, 0);
    return {
      kind: "unpaid",
      message:
        unpaid.length === 1
          ? `${unpaid[0].card.name} 還沒付款 $${formatMoney(total)}`
          : `${unpaid.length} 張課卡還沒付款，共 $${formatMoney(total)}`,
      // 只有一張時直接在這裡確認收款；多張就到課卡分頁一張一張處理。
      card: unpaid.length === 1 ? unpaid[0] : null,
    };
  }

  const remaining = student.studentCards
    .filter((card) => !card.expiredAt)
    .reduce((sum, card) => sum + Math.max(0, card.remainingSessions), 0);

  if (student.tags?.some((tag) => tag.name === NEEDS_RENEWAL_TAG)) {
    return {
      kind: "renewal",
      message: remaining === 0 ? "課卡用完了，需要續卡" : `只剩 ${remaining} 堂，快用完了`,
    };
  }

  const lastAttendAt = student.overview.lastAttendAt;
  const days = lastAttendAt ? differenceInCalendarDays(now, new Date(lastAttendAt)) : null;
  if (remaining > 0 && days !== null && days > ACTIVE_DAYS) {
    return { kind: "idle", message: `還有 ${remaining} 堂，但已經 ${days} 天沒來` };
  }
  return null;
}
