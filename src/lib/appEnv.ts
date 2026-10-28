/**
 * 現在跑在哪個環境。只有 staging 會設 `NEXT_PUBLIC_APP_ENV=staging`（Vercel 自訂環境 `staging`）。
 * staging 的資料每天從正式環境複製（scripts/staging-refresh.sh），所以：
 *  - 畫面上要一直看得到「測試環境」（StagingBanner）；
 *  - **任何對外的推播都不送**（App、網頁推播、LINE push）——資料裡是真的老師和學生。
 *    LINE 的 reply（回覆對方剛傳來的訊息）照常，那是在測試帳號裡跟 bot 對話。
 *
 * Shared by server and client — no server-only imports here.
 */
export function isStaging(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "staging";
}

/** 對外推播的總開關：staging 一律關，呼叫端記 log 後當成沒送。 */
export function outboundPushDisabled(): boolean {
  return isStaging();
}
