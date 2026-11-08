"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Unlink } from "lucide-react";
import KiwiLogo from "@/components/KiwiLogo";

type Display = { classroomName: string; url: string };

// How often the kiosk re-checks its key. A rotated key should stop showing a
// dead QR within minutes, without hammering the API from an iPad left on all day.
const POLL_MS = 5 * 60 * 1000;

/**
 * Keep the screen on while the page is visible (Wake Lock API, iOS 16.4+).
 * The lock is dropped whenever the page is hidden, so it's re-requested on
 * every return. Unsupported browsers just rely on 自動鎖定 → 永不.
 */
function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) next.release();
        else lock = next;
      } catch {
        // Low Power Mode or a denied request — nothing to do.
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release();
    };
  }, []);
}

/**
 * Re-fetch the display on an interval and whenever the iPad comes back to the
 * page or back online. Only a definite 404 kills the QR; network errors keep
 * showing the last good one (the studio Wi-Fi drops, the key didn't change).
 */
function useCheckinDisplay(checkinKey: string, initial: Display | null) {
  const [display, setDisplay] = useState(initial);
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/checkin-display/${encodeURIComponent(checkinKey)}`, { cache: "no-store" });
        if (res.status === 404) setDisplay(null);
        else if (res.ok) setDisplay(await res.json());
      } catch {
        // Offline — keep the current QR.
      }
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [checkinKey]);
  return display;
}

const STEPS = ["用手機相機掃描", "在 LINE 裡選擇自己", "勾選今天上的課"];

// The pale hill along the bottom — sized in vmin so it sits the same in both orientations.
const Hill = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute -bottom-[62vmin] left-1/2 h-[92vmin] w-[150vmax] -translate-x-1/2 rounded-[50%] bg-primary-100"
  />
);

/**
 * iPad kiosk for the studio door: a big check-in QR, nothing else. Landscape
 * puts the QR left and the copy right; portrait stacks them. Everything is sized
 * in viewport units so it fills an iPad of any size without a breakpoint.
 */
const CheckinDisplay = ({ checkinKey, initial }: { checkinKey: string; initial: Display | null }) => {
  useWakeLock();
  const display = useCheckinDisplay(checkinKey, initial);

  return (
    <main className="fixed inset-0 overflow-hidden bg-white text-[#123F33] select-none">
      <Hill />
      {display ? (
        <div className="relative flex h-full items-center justify-center gap-[7vw] px-[6vw] py-[5vh] portrait:flex-col portrait:gap-[5vh]">
          {/* Title — above the QR in portrait, beside it in landscape. */}
          <Heading name={display.classroomName} className="landscape:hidden" />

          <div className="relative rounded-[4vmin] border border-primary-100 bg-white p-[3.5vmin] shadow-[0_2vmin_5vmin_rgba(27,94,74,0.14)]">
            <KiwiLogo className="absolute right-[5vmin] -top-[7.2vmin] w-[11vmin] text-primary-900" />
            <QRCodeSVG
              value={display.url}
              size={512}
              level="M"
              className="block size-[min(60vh,46vw)] portrait:size-[min(66vw,44vh)]"
            />
          </div>

          <div className="flex flex-col gap-[5vmin] portrait:w-full">
            <Heading name={display.classroomName} className="portrait:hidden" />
            <ol className="flex flex-col gap-[2.6vmin] portrait:grid portrait:grid-cols-3 portrait:gap-[3vw]">
              {STEPS.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-[2vmin] text-[3.1vmin] font-medium portrait:flex-col portrait:text-center"
                >
                  <span className="flex size-[5.6vmin] flex-none items-center justify-center rounded-full bg-primary-900 text-[2.6vmin] font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <Expired />
      )}
    </main>
  );
};

const Heading = ({ name, className }: { name: string; className?: string }) => (
  <div className={`flex flex-col gap-[1vmin] portrait:items-center portrait:text-center ${className ?? ""}`}>
    <div className="flex items-center gap-[1.2vmin] text-[1.8vmin] font-semibold tracking-[0.24em] text-primary-700">
      <KiwiLogo className="w-[3.4vmin]" />
      GOOGOOCARD
    </div>
    <h1 className="max-w-[80vw] break-words text-[7.6vmin] leading-tight font-bold">{name}</h1>
    <p className="text-[4.8vmin] font-bold text-primary-700">上課簽到</p>
  </div>
);

const Expired = () => (
  <div className="relative flex h-full items-center justify-center p-[6vmin]">
    <div className="flex w-full max-w-[84vmin] flex-col items-center gap-[2.4vmin] rounded-[4vmin] border border-primary-100 bg-white px-[6vmin] py-[6vmin] text-center text-neutral-900 shadow-[0_2vmin_5vmin_rgba(27,94,74,0.14)]">
      <span className="flex size-[10vmin] items-center justify-center rounded-full bg-warning-100">
        <Unlink className="size-[5vmin] text-warning-700" />
      </span>
      <h1 className="text-[4.2vmin] font-bold">這個簽到畫面已失效</h1>
      <p className="text-[2.5vmin] leading-relaxed text-neutral-600">
        老師已重新產生 QR Code。
        <br />
        請到後台「教室設定 → 簽到 QR」用 iPad 重新掃描開啟。
      </p>
      <p className="mt-[1vmin] text-[2vmin] text-neutral-500">同學：請先找老師或助教簽到</p>
    </div>
  </div>
);

export default CheckinDisplay;
