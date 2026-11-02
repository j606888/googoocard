export type IncomeSource = {
  kind: "card" | "absence" | "dropIn";
  refId: number; // attendanceRecord.id / absence.id / dropInCharge.id
  studentId: number;
  amount: number; // card/absence: finalPrice/totalSessions*sessionsUsed; dropIn: amount
  paid: boolean;
  holderUserId: number | null; // who holds the money (paidByUserId ?? legacy)
};

export type PendingNote = {
  studentId: number;
  kind: "unpaid" | "undecided";
  amount: number | null;
};

/** Value of one session of a card. A gift card (finalPrice 0) is worth 0. */
export function cardUnitValue(card: { finalPrice: number; totalSessions: number }): number {
  return card.finalPrice / card.totalSessions;
}

/** Realized income of one period: only paid sources count; the rest are pending notes. */
export function periodIncome(
  sources: IncomeSource[],
  undecidedStudentIds: number[],
): { realized: IncomeSource[]; total: number; pending: PendingNote[] } {
  const realized = sources.filter((s) => s.paid);
  const pending: PendingNote[] = [
    ...sources
      .filter((s) => !s.paid)
      .map((s) => ({ studentId: s.studentId, kind: "unpaid" as const, amount: s.amount })),
    ...undecidedStudentIds.map((studentId) => ({
      studentId,
      kind: "undecided" as const,
      amount: null,
    })),
  ];
  return { realized, total: realized.reduce((sum, s) => sum + s.amount, 0), pending };
}
