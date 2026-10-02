// 課卡轉換的換算規則 —— 純函式，轉換表單的即時預覽與 convert API 的預設堂數
// 共用同一份，確保老師看到的建議值就是 API 不帶 sessions 時會用的值。
//
// 規則（2026-10-02 定案）：
// - 舊卡帶走的是「剩餘價值」= 實付單堂價 × 剩餘堂數（已上過的堂數已經認列過了）。
// - 建議堂數 = 剩餘價值 ÷ 新卡牌價單堂價，四捨五入，至少 1 堂。
// - 老師可以手動改；超過換算值只提醒（等於加贈）、不擋 —— 補償／加碼是正當情境。

/** 舊卡剩餘價值 — 已經上過的堂數已認列在過去的每日營收裡，不再帶過來。 */
export function residualValueOf(sourceCard: {
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
}) {
  return Math.round(
    (sourceCard.finalPrice / sourceCard.totalSessions) * sourceCard.remainingSessions
  );
}

export type ConversionSuggestion = {
  /** 精確換算值，例 4.2857… */
  exact: number;
  /** 預設堂數：四捨五入、至少 1 */
  suggested: number;
  /** 剛好整除（不需要提示取整） */
  isExact: boolean;
};

export function suggestConversion({
  residualValue,
  targetPrice,
  targetSessions,
}: {
  residualValue: number;
  targetPrice: number;
  targetSessions: number;
}): ConversionSuggestion {
  // 0 元卡（招待卡）沒有單價可換算，就當作等堂轉換的最小值 1 堂。
  if (targetPrice <= 0 || targetSessions <= 0) {
    return { exact: 1, suggested: 1, isExact: true };
  }
  const exact = residualValue / (targetPrice / targetSessions);
  const rounded = Math.round(exact);
  return {
    exact,
    suggested: Math.max(1, rounded),
    isExact: Math.abs(exact - rounded) < 1e-9,
  };
}

/** 以新卡牌價計，這個堂數值多少錢（比較表與「等於加贈 $X」用）。 */
export function listValueOf(sessions: number, targetPrice: number, targetSessions: number) {
  if (targetSessions <= 0) return 0;
  return Math.round((targetPrice / targetSessions) * sessions);
}
