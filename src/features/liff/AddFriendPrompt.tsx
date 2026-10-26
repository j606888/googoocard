"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMockLiff, loadLiff } from "@/lib/liffClient";

const OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID ?? "";

/**
 * 「加入官方帳號」：掃門口 QR 進來的人不一定加了好友，沒加就收不到續卡提醒、聊天室
 * 也叫不出選單。LIFF 的 Add friend option（Aggressive）只問一次、可以拒絕，所以簽到
 * 完成時再用 getFriendship() 檢查一次。查不到（LIFF 沒連官方帳號）就不顯示。
 */
const AddFriendPrompt = () => {
  const [show, setShow] = useState(false);
  const mock = isMockLiff();
  const oaId = OA_ID || (mock ? "@googoocard-mock" : "");

  useEffect(() => {
    if (!oaId) return;
    let cancelled = false;
    (async () => {
      try {
        const liff = await loadLiff();
        const { friendFlag } = await liff.getFriendship();
        if (!cancelled) setShow(!friendFlag);
      } catch {
        // Not in a LIFF linked to the OA — nothing to ask.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oaId]);

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <UserPlus className="h-5 w-5 shrink-0 text-primary-700" />
      <p className="flex-1 text-sm leading-relaxed">
        加入官方帳號，課卡快用完會通知你，聊天室也能直接叫出選單
      </p>
      <Button asChild size="sm">
        <a
          href={`https://line.me/R/ti/p/${encodeURIComponent(oaId)}`}
          // The simulator's phone is an iframe and line.me refuses to be framed.
          target={mock ? "_blank" : undefined}
          rel="noreferrer"
        >
          加好友
        </a>
      </Button>
    </div>
  );
};

export default AddFriendPrompt;
