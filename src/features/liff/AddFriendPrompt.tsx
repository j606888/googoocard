"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
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
    <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[#06C755] bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#06C755]">
          <UserPlus className="size-5 text-white" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="font-semibold text-neutral-900">加入 Googoocard 好友</span>
          <span className="text-xs text-neutral-500">還沒加的話，下次會找不到入口</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-neutral-700">
        {["下次從聊天室選單一鍵簽到", "課卡快用完時提醒你", "隨時看課表和剩幾堂"].map((line) => (
          <li key={line} className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-primary-700" strokeWidth={2.8} aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      <a
        href={`https://line.me/R/ti/p/${encodeURIComponent(oaId)}`}
        // The simulator's phone is an iframe and line.me refuses to be framed.
        target={mock ? "_blank" : undefined}
        rel="noreferrer"
        className="flex h-11 items-center justify-center rounded-xl bg-[#06C755] text-[15px] font-bold text-white"
      >
        加入好友
      </a>
    </div>
  );
};

export default AddFriendPrompt;
