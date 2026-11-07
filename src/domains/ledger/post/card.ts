// 課卡來源（CARD）：賣卡、收款、轉換／轉讓、到期、作廢、退費。docs/finance-v2/02 §3.1、§3.3。
// 上課認列不在這裡，在 PERIOD（period.ts）。
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { sessionSliceValue, toCents } from "../money";
import type { DesiredLine } from "../lines";
import type { CardInput, PostResult, PostingContext } from "./types";

const usageKey = (kind: string, id: number) => `${kind}:${id}`;

/**
 * 每次使用的價值（分）：依使用順序（時段開始時間、出席先於缺席、id）切卡的格子，
 * 最後一格吃尾差。回傳 "attendance:12" / "absence:3" → 分。
 */
export function cardUsageValues(card: Pick<CardInput, "finalPrice" | "totalSessions" | "usages">): Map<string, number> {
  const sorted = [...card.usages].sort(
    (a, b) =>
      a.startTime.getTime() - b.startTime.getTime() ||
      (a.kind === b.kind ? 0 : a.kind === "attendance" ? -1 : 1) ||
      a.id - b.id,
  );
  const out = new Map<string, number>();
  let used = 0;
  for (const u of sorted) {
    out.set(usageKey(u.kind, u.id), sessionSliceValue(card.finalPrice, card.totalSessions, used, u.sessionsUsed));
    used += u.sessionsUsed;
  }
  return out;
}

export function usageValueKey(kind: "attendance" | "absence", id: number) {
  return usageKey(kind, id);
}

/** 卡關閉時剩下的價值（分）：最後 remainingSessions 格的價值。 */
export function cardRemainingValue(card: Pick<CardInput, "finalPrice" | "totalSessions" | "remainingSessions">): number {
  const remaining = Math.max(0, Math.min(card.remainingSessions, card.totalSessions));
  return sessionSliceValue(card.finalPrice, card.totalSessions, card.totalSessions - remaining, remaining);
}

/** 錢在誰手上：收款人；上線前沒記收款人的已付款卡算 legacy 保管人。 */
export function cardHolder(card: Pick<CardInput, "isPaid" | "paidByUserId">, ctx: PostingContext): number | null {
  if (!card.isPaid) return null;
  return card.paidByUserId ?? ctx.legacyHolderUserId;
}

/** 這張卡的預收記在哪個分部：賣卡分部 → 收款人的資金帳戶分部 → 預設分部。 */
export function cardDeferredLocation(
  card: Pick<CardInput, "soldLocationId" | "isPaid" | "paidByUserId">,
  ctx: PostingContext,
): number | null {
  if (card.soldLocationId !== null && ctx.locationExists(card.soldLocationId)) return card.soldLocationId;
  const holder = cardHolder(card, ctx);
  const ma = holder !== null ? ctx.moneyAccountOf(holder) : null;
  return ma?.locationId ?? ctx.defaultLocationId;
}

export type ConvertedFrom = { cardId: number; value: number; locationId: number; closedAt: Date };

/**
 * 一張卡應有的分錄。convertedFrom：轉換／轉讓到這張卡的舊卡（剩餘價值與預收分部），
 * 搬移分錄由新卡負責，舊卡關閉時不另外記。
 */
export function postCard(card: CardInput, ctx: PostingContext, convertedFrom: ConvertedFrom[] = []): PostResult {
  const lines: DesiredLine[] = [];
  const errors: string[] = [];
  const C = ctx.conversionDate;
  const party = { type: "STUDENT_CARD" as const, id: card.id };
  const price = toCents(card.finalPrice);

  const loc = cardDeferredLocation(card, ctx);
  if (loc === null) return { lines, errors: ["NO_LOCATION"] };

  const saleDate = toTaipeiDateKey(card.createdAt);

  // 賣卡
  if (saleDate >= C) {
    if (card.origin === "PURCHASE") {
      if (price !== 0) {
        lines.push({ date: saleDate, account: { key: "AR" }, locationId: loc, amount: price, party });
        lines.push({ date: saleDate, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: -price, party });
      }
    } else {
      // 轉換／轉讓：舊卡的預收搬過來；實收和搬來的總額之間的差額調整過期收入。
      let moved = 0;
      for (const f of convertedFrom) {
        const d = toTaipeiDateKey(f.closedAt);
        if (d < C || f.value === 0) continue;
        lines.push({ date: d, account: { key: "DEFERRED_REVENUE" }, locationId: f.locationId, amount: f.value, party: { type: "STUDENT_CARD", id: f.cardId } });
        lines.push({ date: d, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: -f.value, party });
        moved += f.value;
      }
      const adj = price - moved;
      if (adj !== 0) {
        lines.push({ date: saleDate, account: { key: "REVENUE_BREAKAGE" }, locationId: loc, amount: adj, party });
        lines.push({ date: saleDate, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: -adj, party });
      }
    }
  }

  // 收款（只有真的有金流的購買）
  if (card.origin === "PURCHASE" && card.isPaid && price !== 0) {
    const payDate = toTaipeiDateKey(card.paidAt ?? card.createdAt);
    if (payDate >= C) {
      const holder = cardHolder(card, ctx);
      const ma = holder !== null ? ctx.moneyAccountOf(holder) : null;
      if (!ma) errors.push("NO_MONEY_ACCOUNT");
      else {
        lines.push({ date: payDate, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: price, party });
        lines.push({ date: payDate, account: { key: "AR" }, locationId: loc, amount: -price, party });
      }
    }
  }

  // 關閉（轉換／轉讓由新卡記）
  const closedByMove = card.convertedToId !== null || card.transferredToId !== null;
  if (card.expiredAt && !closedByMove) {
    const closeDate = toTaipeiDateKey(card.expiredAt);
    const rem = cardRemainingValue(card);
    if (closeDate >= C) {
      if (card.closedReason === "REFUNDED" && card.refund) {
        const refundDate = toTaipeiDateKey(card.refund.date);
        const refund = toCents(card.refund.amount);
        const ma = ctx.moneyAccountOf(card.refund.paidByUserId);
        if (!ma) errors.push("NO_MONEY_ACCOUNT");
        else {
          lines.push({ date: refundDate, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: rem, party });
          lines.push({ date: refundDate, account: { moneyAccountId: ma.id }, locationId: ma.locationId, amount: -refund, party });
          if (rem - refund !== 0) {
            lines.push({ date: refundDate, account: { key: "REVENUE_BREAKAGE" }, locationId: loc, amount: -(rem - refund), party });
          }
        }
      } else if ((card.closedReason === "EXPIRED" || card.closedReason === "VOIDED") && rem > 0) {
        lines.push({ date: closeDate, account: { key: "DEFERRED_REVENUE" }, locationId: loc, amount: rem, party });
        if (card.isPaid) {
          lines.push({ date: closeDate, account: { key: "REVENUE_BREAKAGE" }, locationId: loc, amount: -rem, party });
          const userId = ctx.expiryUserOf(loc);
          if (userId !== null) {
            // 過期收入給某人＝先進分部、再宣告分紅（02 §3.3）
            lines.push({ date: closeDate, account: { key: "RETAINED_EARNINGS" }, locationId: loc, amount: rem, party });
            lines.push({ date: closeDate, account: { key: "OWNER_PAYABLE" }, locationId: loc, amount: -rem, party: { type: "USER", id: userId } });
          }
        } else {
          // 沒付款的卡過期：取消這部分應收
          lines.push({ date: closeDate, account: { key: "AR" }, locationId: loc, amount: -rem, party });
        }
      }
    }
  }

  return { lines, errors };
}
