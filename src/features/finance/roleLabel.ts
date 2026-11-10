import { roleLabel } from "@/lib/roles";

/** 財務的成員選單：擁有者要顯示「擁有者」（全站的 ROLE_LABELS 把他算進「管理員」）。 */
export function financeRoleLabel(role: string): string {
  return role === "owner" ? "擁有者" : roleLabel(role);
}
