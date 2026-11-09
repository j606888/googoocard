// 開帳精靈的明細（feedback 07 #12a、#12d）：期初現金背後是哪幾張卡、次數包剩幾次。
// 只給畫面看，不影響分錄；期初分錄本身仍由 ./opening.ts 的 previewOpening 算。
import prisma from "@/lib/prisma";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { computeOpening } from "@/domains/ledger/opening";
import { toCents } from "@/domains/ledger/money";
import { loadLedgerInputs } from "./load";

export type OpeningCardDetail = {
  cardId: number;
  studentName: string;
  cardName: string;
  /** 哪天買的（台北日期 YYYY-MM-DD）。 */
  purchasedOn: string;
  /** 這張卡總共幾堂。 */
  totalSessions: number;
  /** 實收價格（分）。 */
  price: number;
  /** 轉換日那天開始時還剩幾堂（現在剩的＋轉換日之後用掉的）。 */
  sessionsLeft: number;
  /** 還沒上完的價值（分）。 */
  deferred: number;
  /** 還沒付的金額（分）。 */
  receivable: number;
  /** 錢在誰手上（約定法：期初現金算給他）；沒付過款的卡是 null。 */
  holderUserId: number | null;
  locationId: number;
};

export type OpeningPackDetail = {
  venueId: number;
  venueName: string;
  sessions: number;
  /** 預付場地費（分）。 */
  amount: number;
};

export async function openingDetail(
  classroomId: number,
  conversionDate: string,
): Promise<{ cards: OpeningCardDetail[]; packs: OpeningPackDetail[] }> {
  const start = parseTaipeiDateRange(conversionDate).start;
  const [inputs, rawPacks] = await Promise.all([
    loadLedgerInputs(classroomId, { conversionDate }),
    prisma.venuePack.findMany({
      where: { classroomId, voidedAt: null, purchasedAt: { lt: start } },
      select: { venueId: true, sessions: true, price: true, venue: { select: { name: true } } },
      orderBy: [{ venueId: "asc" }, { id: "asc" }],
    }),
  ]);
  if (!inputs) return { cards: [], packs: [] };

  // 卡片的部分跟方法、現金、待付無關，用空的參數算一次就好。
  const { cards } = computeOpening({
    conversionDate,
    method: "CONVENTION",
    cards: inputs.cards,
    ctx: inputs.ctx,
    cash: [],
    prepaidVenues: [],
    payables: [],
    moneyAccountLocation: () => null,
  });
  const byId = new Map(inputs.cards.map((c) => [c.id, c]));
  const names = await prisma.studentCard.findMany({
    where: { id: { in: cards.map((c) => c.cardId) }, student: { classroomId } },
    select: { id: true, student: { select: { name: true } }, card: { select: { name: true } } },
  });
  const nameOf = new Map(names.map((n) => [n.id, n]));

  return {
    cards: cards
      .map((c) => {
        const input = byId.get(c.cardId);
        const usedAfter = (input?.usages ?? [])
          .filter((u) => toTaipeiDateKey(u.startTime) >= conversionDate)
          .reduce((s, u) => s + u.sessionsUsed, 0);
        const n = nameOf.get(c.cardId);
        return {
          cardId: c.cardId,
          studentName: n?.student.name ?? "",
          cardName: n?.card.name ?? "",
          purchasedOn: input ? toTaipeiDateKey(input.createdAt) : "",
          totalSessions: input?.totalSessions ?? 0,
          price: input ? toCents(input.finalPrice) : 0,
          sessionsLeft: (input?.remainingSessions ?? 0) + usedAfter,
          deferred: c.deferred,
          receivable: c.receivable,
          holderUserId: c.holderUserId,
          locationId: c.locationId,
        };
      })
      .sort((a, b) => b.deferred - a.deferred),
    packs: rawPacks.map((p) => ({ venueId: p.venueId, venueName: p.venue.name, sessions: p.sessions, amount: toCents(p.price) })),
  };
}
