/** 一排最多放這麼多顆；超過就拆成兩排。 */
export const MAX_DOTS_PER_ROW = 8;
/** 兩排也放不下（超過這麼多堂）就不畫圓點，改用細進度條。 */
export const MAX_DOTS = MAX_DOTS_PER_ROW * 2;

/**
 * 一張卡的圓點要怎麼排：每排幾顆。課卡通常是 6 或 8 堂（偶爾 12），
 * 8 堂以內排一排；9–16 堂拆成兩排、盡量等長（12 → 6+6、10 → 5+5、9 → 5+4），
 * 不讓它自己折行折成 9+3。更多堂（或 0 堂）回 null，呼叫端改畫進度條。
 */
export function sessionDotRows(total: number): number[] | null {
  if (!Number.isInteger(total) || total <= 0 || total > MAX_DOTS) return null;
  if (total <= MAX_DOTS_PER_ROW) return [total];
  const first = Math.ceil(total / 2);
  return [first, total - first];
}
