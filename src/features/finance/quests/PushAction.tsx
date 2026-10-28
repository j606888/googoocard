"use client";

import { Button } from "@/components/ui/button";
import { useWebPush } from "@/hooks/useWebPush";

/**
 * 「加入主畫面、開通知」：iPhone 要從主畫面打開才能開網頁推播，所以先看狀態再決定教哪一步。
 * compact：新手任務清單裡那一小塊。
 */
export default function PushAction({ compact = false }: { compact?: boolean }) {
  const { status, busy, enable } = useWebPush();
  if (status === "loading") return null;
  if (status === "on") return <span className="text-[13px] font-medium text-primary-900">這個裝置會收到通知</span>;
  if (status === "unsupported") return <span className="text-[13px] text-neutral-500">這個瀏覽器收不到通知，換手機試試</span>;
  if (status === "denied") return <span className="text-[13px] text-danger-700">通知被封鎖了，到瀏覽器的網站設定打開</span>;
  if (status === "needs-install") {
    return (
      <ol className={compact ? "list-decimal pl-5 text-[13px] text-neutral-600" : "list-decimal pl-5 text-sm leading-relaxed text-neutral-600"}>
        <li>點瀏覽器下面的「分享」</li>
        <li>選「加入主畫面」</li>
        <li>從主畫面的圖示打開，再回來這裡開通知</li>
      </ol>
    );
  }
  return (
    <Button size={compact ? "sm" : "md"} onClick={enable} isLoading={busy}>
      開啟通知
    </Button>
  );
}
