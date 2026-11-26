/**
 * 收入 API 共用的 `?locationId=` 篩選：正整數 = 那個分部、`none` = 沒指定分部的課、
 * 沒帶 = 全教室。只會多加一個 `lesson.locationId` 條件，教室範圍仍由呼叫端的
 * `classroomId` 決定，所以帶別間教室的分部 id 只會得到空結果。
 */
export type LocationFilter = { locationId?: number | null };

const POSITIVE_INT = /^[1-9]\d{0,9}$/;
const MAX_INT4 = 2147483647;

/** 回傳要併進 `where.lesson` 的條件；格式不對回 `null`（呼叫端回 400）。 */
export function parseLocationFilter(searchParams: URLSearchParams): LocationFilter | null {
  const raw = searchParams.get("locationId");
  if (raw === null) return {};
  if (raw === "none") return { locationId: null };
  if (!POSITIVE_INT.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_INT4 ? { locationId: id } : null;
}
