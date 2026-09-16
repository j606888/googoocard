import crypto from "crypto";
import { ApiError } from "@/lib/apiError";
import { publicApiRoute } from "@/lib/apiRoute";
import { collectRenewalCandidates, sendRenewalReminders } from "@/service/renewalReminder";

export const maxDuration = 60;

/**
 * Constant-time compare of the `Authorization: Bearer <CRON_SECRET>` header.
 *
 * `CRON_SECRET` is read **inside** the handler, not at module scope: a
 * module-scope read would force a placeholder into CI's env just to build
 * (see the `JWT_SECRET` note in .github/workflows/ci.yml).
 *
 * Unset secret → refuse. `/api` is public in src/middleware.ts, so this check is
 * the only thing standing between the internet and a batch of LINE pushes.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    console.warn("[cron] CRON_SECRET not set; refusing");
    return false;
  }
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * 續卡提醒推播的排程進入點（見 vercel.ts 的 crons）。
 *
 * **GET，不是 POST**：Vercel Cron Jobs 只會對目標路徑發 GET request。
 * Vercel 設了 `CRON_SECRET` 就會自動帶上 `Authorization: Bearer <secret>`。
 *
 * `?dryRun=1` 只回名單、不推播也不寫紀錄——上 production 前先用它確認名單。
 */
export const GET = publicApiRoute(async ({ request }) => {
  if (!authorized(request)) {
    throw new ApiError(401, "UNAUTHORIZED");
  }

  const now = new Date();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  if (dryRun) {
    const candidates = await collectRenewalCandidates(now);
    console.log(`[cron] renewal-reminders dry run: ${candidates.length} candidate(s)`);
    return { dryRun: true, scanned: candidates.length, candidates };
  }

  const result = await sendRenewalReminders(now);
  console.log(
    `[cron] renewal-reminders: scanned=${result.scanned} sent=${result.sent} failed=${result.failed}`,
  );
  return result;
});
