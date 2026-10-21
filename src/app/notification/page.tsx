"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// 點網頁推播通知後的落地頁（public/sw.js 開這裡）：先切到通知所屬的教室，再開
// 對應的頁面。用整頁跳轉，讓 RTK Query 的快取跟著換教室重抓。
function OpenNotification() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next") ?? "/";
    // 只接受站內路徑
    const target = /^\/(?!\/)/.test(next) ? next : "/";
    const classroomId = Number(searchParams.get("classroomId"));

    (async () => {
      if (Number.isInteger(classroomId) && classroomId > 0) {
        // 已經不是成員就照樣開，頁面自己會處理
        await fetch(`/api/classrooms/${classroomId}/switch`, { method: "POST" }).catch(() => {});
      }
      window.location.replace(target);
    })();
  }, [searchParams]);

  return <div className="flex min-h-screen items-center justify-center text-neutral-500">開啟中…</div>;
}

export default function NotificationPage() {
  return (
    <Suspense>
      <OpenNotification />
    </Suspense>
  );
}
