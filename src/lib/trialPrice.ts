/**
 * 體驗卡的預設收費：舊生（買過任何非體驗卡，`isReturningStudent`）免費、
 * 新同學照牌價。老師在課程頁登記體驗時帶入這個價格，可以當場改。
 * 純函式，前後端共用。
 */
export function defaultTrialPrice(card: { price: number; isTrial: boolean }, returning: boolean) {
  return card.isTrial && returning ? 0 : card.price;
}
