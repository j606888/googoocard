"use client";

import { useEffect, useState } from "react";
import { isStaging } from "@/lib/appEnv";
import { toTaipeiDateKey } from "@/lib/taipei-date";

/**
 * 測試環境的標示：任何頁面都看得到的一顆橘色膠囊。
 * 手機（< lg）放在底部、浮動 BottomNav 的上方，不蓋住頁首的標題；桌面維持畫面最上方中間。
 * 不吃點擊（pointer-events-none），不擋下面的按鈕。正式環境什麼都不畫。
 */
export default function StagingBanner() {
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isStaging()) return;
    fetch("/api/staging-info")
      .then((r) => r.json())
      .then((data) => setRefreshedAt(data?.refreshedAt ?? null))
      .catch(() => {});
  }, []);

  if (!isStaging()) return null;
  const when = refreshedAt ? `${toTaipeiDateKey(new Date(refreshedAt)).slice(5).replace("-", "/")} 從正式環境複製` : "資料每天從正式環境複製";

  return (
    <div
      role="note"
      aria-label="測試環境"
      className="pointer-events-none fixed left-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-[max(4px,env(safe-area-inset-top))] z-[100] -translate-x-1/2 max-w-[calc(100vw-2rem)] truncate whitespace-nowrap rounded-full border border-warning-300 bg-warning-100/95 px-3 py-0.5 text-[11px] lg:text-xs font-semibold text-warning-950 shadow-sm"
    >
      測試環境 · {when} · 推播不會發出去
    </div>
  );
}
