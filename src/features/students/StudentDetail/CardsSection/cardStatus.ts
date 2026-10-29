import { format, isSameYear } from "date-fns";
import { formatCardSerial } from "@/lib/cardSerial";

/** 剩這麼多堂（含）以下，卡片的進度條與剩餘堂數改成警示色。 */
export const LOW_REMAINING_SESSIONS = 2;

type CardLike = {
  remainingSessions: number;
  totalSessions: number;
  expiredAt: string | null;
  createdAt: string;
  convertedTo?: { serialNumber: number } | null;
  transferredTo?: { serialNumber: number; student?: { name: string } } | null;
  attendanceRecords: { periodStartTime: number | string }[];
};

/** 有效 = 還有堂數而且沒被停用；其餘歸「已結束」。 */
export const isCardEnded = (card: Pick<CardLike, "remainingSessions" | "expiredAt">) =>
  card.remainingSessions === 0 || !!card.expiredAt;

export const isLowRemaining = (card: Pick<CardLike, "remainingSessions">) =>
  card.remainingSessions <= LOW_REMAINING_SESSIONS;

export type CardOutcome = "transferred" | "converted" | "usedUp" | "expired";

/**
 * 已結束的卡怎麼結束的。轉讓、轉換也會把舊卡停用，所以要先看連結，
 * 再看堂數：用光 →「用完」，其餘是老師手動停用。
 */
export function cardOutcome(
  card: Pick<CardLike, "remainingSessions" | "convertedTo" | "transferredTo">
): CardOutcome {
  if (card.transferredTo) return "transferred";
  if (card.convertedTo) return "converted";
  if (card.remainingSessions === 0) return "usedUp";
  return "expired";
}

/**
 * 結束原因的短句：「已轉讓 4 堂 → 王小明 #A0042」「已轉換 → #A0030」「用完」「已停用」。
 * 公開頁／LIFF 拿不到對方的名字，就只寫編號。
 */
export function cardEndReason(
  card: Pick<CardLike, "remainingSessions" | "convertedTo" | "transferredTo">
): string {
  switch (cardOutcome(card)) {
    case "transferred": {
      const to = card.transferredTo!;
      const who = to.student ? `${to.student.name} ` : "";
      return `已轉讓 ${card.remainingSessions} 堂 → ${who}${formatCardSerial(to.serialNumber)}`;
    }
    case "converted":
      return `已轉換 → ${formatCardSerial(card.convertedTo!.serialNumber)}`;
    case "usedUp":
      return "用完";
    case "expired":
      return "已停用";
  }
}

/** 最後一次扣這張卡的上課時間；沒用過是 null。 */
export function lastUsedAt(card: Pick<CardLike, "attendanceRecords">): number | null {
  return card.attendanceRecords.reduce<number | null>((latest, record) => {
    const time = new Date(record.periodStartTime).getTime();
    return latest === null || time > latest ? time : latest;
  }, null);
}

/** 今年只顯示 M/d，其他年份帶年份。 */
export function shortDate(value: Date | number | string, now = new Date()): string {
  const date = new Date(value);
  return format(date, isSameYear(date, now) ? "M/d" : "yyyy/M/d");
}

/**
 * 一張卡的使用期間「購買日 – 結束日」。結束日取停用時間，沒有就取最後一次扣卡；
 * 從來沒用過也沒停用的卡只顯示購買日。同一天只顯示一次。
 */
export function cardPeriodLabel(
  card: Pick<CardLike, "createdAt" | "expiredAt" | "attendanceRecords">,
  now = new Date()
): string {
  const start = new Date(card.createdAt);
  const lastUse = lastUsedAt(card);
  const endValue = card.expiredAt ? new Date(card.expiredAt).getTime() : lastUse;
  const startLabel = shortDate(start, now);
  if (endValue === null) return startLabel;
  const endLabel = shortDate(endValue, now);
  return endLabel === startLabel ? startLabel : `${startLabel} – ${endLabel}`;
}
