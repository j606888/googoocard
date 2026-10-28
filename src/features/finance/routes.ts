/** 水庫的網址只在這裡組（docs/modules-plan.md §3.2）。 */
const BASE = "/finance";

export const financeHref = {
  home: BASE,
  ledger: `${BASE}/ledger`,
  vault: `${BASE}/vault`,
  verify: `${BASE}/verify`,
  day: (date: string) => `${BASE}/day/${date}`,
  rules: `${BASE}/rules`,
  settings: `${BASE}/settings`,
  holder: (userId: number) => `${BASE}/holders/${userId}`,
};
