interface RevenueRecord {
  studentCard: { finalPrice: number; totalSessions: number } | null;
}

/**
 * 每堂課營收 = Σ 已扣卡學生的「該卡單堂價」(finalPrice / totalSessions)。
 * 未扣卡(studentCard 為 null)不計入。
 */
export function periodRevenue(records: RevenueRecord[]): number {
  return records.reduce((sum, record) => {
    if (!record.studentCard) return sum;
    return sum + record.studentCard.finalPrice / record.studentCard.totalSessions;
  }, 0);
}
