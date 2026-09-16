import type { VercelConfig } from "@vercel/config/v1";

/**
 * 專案原本沒有任何 Vercel 設定檔（build 設定靠 dashboard 自動偵測），
 * 這份只宣告 cron，其餘一律不覆寫。
 *
 * 排程以 UTC 計算：`0 2 * * *` = 台北早上 10:00。每天一次，Hobby / Pro 都合法。
 * 目標 route 自己驗 `CRON_SECRET`（Vercel 會自動帶成 Authorization header）。
 */
export const config: VercelConfig = {
  crons: [{ path: "/api/cron/renewal-reminders", schedule: "0 2 * * *" }],
};
