/** "2000" → "2,000". Every displayed amount goes through this. */
export function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString();
}
