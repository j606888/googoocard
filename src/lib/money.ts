/** "2000" → "2,000". Every displayed amount goes through this. */
export function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString();
}

/** 一個人在某堂分到的錢：整數照寫，除不盡的（$2000 ÷ 6）留一位小數，才對得起總收入。 */
export function formatShare(amount: number): string {
  return `$${Number.isInteger(amount) ? amount.toLocaleString() : (Math.round(amount * 10) / 10).toLocaleString()}`;
}
