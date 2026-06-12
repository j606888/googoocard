"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Entry point opened from the LINE menu's "進入網站" button.
// Uses LIFF + LINE Login to authenticate, then starts a googoocard session —
// no email/password needed.
export default function LiffPage() {
  const router = useRouter();
  const [status, setStatus] = useState("登入中…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setStatus("尚未設定 LIFF ID");
        return;
      }

      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login(); // redirects to LINE, then back to this page
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          setStatus("無法取得 LINE 身分，請重新開啟。");
          return;
        }

        const res = await fetch("/api/line/liff-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (cancelled) return;

        if (res.ok) {
          router.replace("/redirect");
        } else if (res.status === 403) {
          setStatus("此 LINE 帳號尚未綁定 googoocard，請先用密碼登入並完成綁定。");
        } else {
          setStatus("登入失敗，請稍後再試。");
        }
      } catch (err) {
        console.error("[liff] init error", err);
        if (!cancelled) setStatus("LIFF 初始化失敗。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-primary-500 text-white">
      <div className="text-lg font-semibold">googoocard</div>
      <div className="text-sm opacity-90">{status}</div>
    </div>
  );
}
