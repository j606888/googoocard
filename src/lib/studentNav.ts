// 組學生詳情連結，可選帶上來源頁（按返回時會回到此頁）
export function studentDetailHref(studentId: number, from?: string | null) {
  const base = `/students/${studentId}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

// 解析返回目標；只接受站內路徑，否則 fallback 學生列表
export function resolveBackHref(from: string | null | undefined) {
  return from && from.startsWith("/") ? from : "/students";
}
