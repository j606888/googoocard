const ERROR_TEXT: Record<string, string> = {
  LOCATION_REQUIRED: "這間教室開了財務，每門課都要選分部",
  LOCATION_NOT_FOUND: "找不到這個分部，請重新選一個",
  GIFT_CARD_NOT_SELLABLE: "贈送卡不能掛在課上",
};

/** 建立／儲存課程的 RTK Query 錯誤 → 白話。 */
export function lessonErrorText(e: unknown, fallback: string): string {
  const data = (e as { data?: { code?: string; error?: string } })?.data;
  const code = data?.code ?? data?.error;
  return (code && ERROR_TEXT[code]) || fallback;
}

export const isLocationRequiredError = (e: unknown) =>
  (e as { data?: { code?: string } })?.data?.code === "LOCATION_REQUIRED";
