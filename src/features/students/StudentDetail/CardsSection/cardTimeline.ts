import type { StudentCardWithCard } from "@/store/slices/students";
import { cardOutcome } from "./cardStatus";

/**
 * 一張課卡從頭到尾發生過的事，新的在前：怎麼來的（購買／轉換／轉讓轉入）、
 * 收款、每次上課扣卡、怎麼結束的（轉讓／轉換／停用）。用完不另列——
 * 最後一次上課就是結束。詳情對話框的「紀錄」直接照這份畫。
 */
export type CardTimelineEntry =
  | { kind: "purchase"; at: number }
  | { kind: "convertedFrom"; at: number }
  | { kind: "transferredIn"; at: number }
  | { kind: "payment"; at: number }
  | { kind: "use"; at: number; lessonName: string; source: "TEACHER" | "STUDENT"; pending: boolean }
  | { kind: "transferredOut"; at: number }
  | { kind: "convertedTo"; at: number }
  | { kind: "expired"; at: number };

/** 建卡當下就收款（老師登記時收現金）的，收款併在購買那一列，不另列。 */
const SAME_MOMENT_MS = 60_000;

export function buildCardTimeline(card: StudentCardWithCard): CardTimelineEntry[] {
  const createdAt = new Date(card.createdAt).getTime();
  const entries: CardTimelineEntry[] = [];

  if (card.origin === "TRANSFER") entries.push({ kind: "transferredIn", at: createdAt });
  else if (card.origin === "CONVERSION") entries.push({ kind: "convertedFrom", at: createdAt });
  else entries.push({ kind: "purchase", at: createdAt });

  if (card.origin === "PURCHASE" && card.isPaid && card.paidAt) {
    const paidAt = new Date(card.paidAt).getTime();
    if (paidAt - createdAt > SAME_MOMENT_MS) entries.push({ kind: "payment", at: paidAt });
  }

  for (const record of card.attendanceRecords) {
    entries.push({
      kind: "use",
      at: new Date(record.periodStartTime).getTime(),
      lessonName: record.lessonName,
      source: record.source,
      pending: record.pending,
    });
  }

  if (card.expiredAt) {
    const at = new Date(card.expiredAt).getTime();
    const outcome = cardOutcome(card);
    if (outcome === "transferred") entries.push({ kind: "transferredOut", at });
    else if (outcome === "converted") entries.push({ kind: "convertedTo", at });
    else if (outcome === "expired") entries.push({ kind: "expired", at });
  }

  return entries.sort((a, b) => b.at - a.at);
}

/** 建卡時就收款了嗎（收款資訊併在購買那一列）。 */
export function paidAtPurchase(card: Pick<StudentCardWithCard, "createdAt" | "isPaid" | "paidAt">) {
  if (!card.isPaid || !card.paidAt) return false;
  return new Date(card.paidAt).getTime() - new Date(card.createdAt).getTime() <= SAME_MOMENT_MS;
}
