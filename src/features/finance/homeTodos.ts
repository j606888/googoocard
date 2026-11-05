import type { BranchScope } from "@/domains/finance/waterfall";

type Scoped = { locationId: number | null };

/** 只留這個分部的項目；`locationId = null`（不屬於任何分部）每個分部都看得到。 */
export function inBranch<T extends Scoped>(items: T[], scope: BranchScope): T[] {
  return scope === "all" ? items : items.filter((i) => i.locationId === null || i.locationId === scope);
}

/** 預設看「我負責的分部」；沒負責、或那個分部已經不在清單上 → 全教室。 */
export function defaultScope(myLocationId: number | null, branches: { id: number }[]): BranchScope {
  return myLocationId !== null && branches.some((b) => b.id === myLocationId) ? myLocationId : "all";
}
