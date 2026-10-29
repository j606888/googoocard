interface RevenueRecord {
  studentCard: { finalPrice: number; totalSessions: number } | null;
  /** 這筆出席扣了幾格（外師課 = 2）；省略 = 1。 */
  sessionsUsed?: number;
}

/**
 * 每堂課營收 = Σ 已扣卡學生的「該卡單格價」(finalPrice / totalSessions) × 扣的格數。
 * 未扣卡(studentCard 為 null)不計入。
 */
export function periodRevenue(records: RevenueRecord[]): number {
  return records.reduce((sum, record) => {
    if (!record.studentCard) return sum;
    return (
      sum +
      (record.studentCard.finalPrice / record.studentCard.totalSessions) * (record.sessionsUsed ?? 1)
    );
  }, 0);
}
