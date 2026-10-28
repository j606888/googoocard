/** 水庫的網址只在這裡組（docs/modules-plan.md §3.2）。 */
const BASE = "/finance";

export const financeHref = {
  home: BASE,
  vault: `${BASE}/vault`,
  settings: `${BASE}/settings`,
  holder: (userId: number) => `${BASE}/holders/${userId}`,
};
