import { useGetFinanceSettingsQuery } from "@/store/slices/finance";

/**
 * 這個教室有沒有開財務（有任何分部設了轉換日）。決定導覽列的「財務」和課程頁的「分帳」。
 * 還在載入時回 `undefined`——當作「載入中」，不要當作「沒開」。
 */
export function useFinanceEnabled(): boolean | undefined {
  const { data } = useGetFinanceSettingsQuery();
  return data?.enabled;
}
