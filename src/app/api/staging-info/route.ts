import prisma from "@/lib/prisma";
import { publicApiRoute } from "@/lib/apiRoute";
import { isStaging } from "@/lib/appEnv";

/**
 * 測試環境的資料是什麼時候從正式環境複製來的（StagingBanner 顯示用）。
 * `_StagingInfo` 不在 Prisma schema 裡：只有 staging 資料庫有，由 scripts/staging-refresh.sh 每次複製完寫入。
 * 不是 staging、或還沒複製過，回 null。
 */
export const GET = publicApiRoute(async () => {
  if (!isStaging()) return null;
  try {
    const rows = await prisma.$queryRaw<{ refreshed_at: Date }[]>`SELECT refreshed_at FROM "_StagingInfo" ORDER BY refreshed_at DESC LIMIT 1`;
    return { refreshedAt: rows[0]?.refreshed_at ?? null };
  } catch {
    return { refreshedAt: null };
  }
});
