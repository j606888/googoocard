"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLiffId, loadLiff } from "@/lib/liffClient";

// The LIFF endpoint itself. A deep link like liff.line.me/<id>/checkin first lands
// here with `?liff.state=/checkin`; liff.init() then forwards to that page. Opened
// bare (no state), it goes to 上課簽到 — LINE is student-only, teachers use the site.
export default function LiffPage() {
  const router = useRouter();
  const [status, setStatus] = useState("載入中…");

  useEffect(() => {
    (async () => {
      const liffId = getLiffId();
      if (!liffId) {
        setStatus("尚未設定 LIFF ID");
        return;
      }
      const forwarding = new URLSearchParams(window.location.search).has("liff.state");
      try {
        const liff = await loadLiff();
        await liff.init({ liffId });
        if (!forwarding) router.replace("/liff/checkin");
      } catch (err) {
        console.error("[liff] init error", err);
        setStatus("LIFF 初始化失敗。");
      }
    })();
  }, [router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-primary-900 text-white">
      <div className="text-lg font-semibold">googoocard</div>
      <div className="text-sm opacity-90">{status}</div>
    </div>
  );
}
