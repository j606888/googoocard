"use client";

import { useCallback, useEffect, useState } from "react";
import { isInApp } from "@/lib/inApp";

/**
 * 「加入主畫面」的狀態。iOS 不會自己跳安裝提示，只能靠我們引導。
 *
 * - `installed`   — 已經從主畫面開啟（standalone），或在老師端 iOS App 裡
 * - `ios-browser` — iPhone / iPad 的瀏覽器分頁，可以照步驟加入主畫面
 * - `ios-in-app`  — LINE / FB / IG 內建瀏覽器：沒有「加入主畫面」，要先換 Safari
 * - `other`       — 其他平台，不引導
 * - `unknown`     — SSR 與首次 render（還沒讀 navigator）
 */
export type InstallState =
  | "unknown"
  | "installed"
  | "ios-browser"
  | "ios-in-app"
  | "other";

export function detectInstallState(env: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}): InstallState {
  if (env.standalone || isInApp(env.userAgent)) return "installed";
  const ua = env.userAgent;
  // iPadOS 13+ 預設回報桌面版 Mac UA，只能靠觸控點判斷
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  if (!isIOS) return "other";
  if (/\bLine\/|FBAN|FBAV|Instagram/i.test(ua)) return "ios-in-app";
  return "ios-browser";
}

const DISMISS_KEY = "googoocard:install-banner-dismissed";

/** localStorage 在私密瀏覽或被封鎖時會丟例外，失敗就當沒關過。 */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useInstallState() {
  const [state, setState] = useState<InstallState>("unknown");
  const [bannerDismissed, setBannerDismissed] = useState(true);

  useEffect(() => {
    setState(
      detectInstallState({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        standalone:
          window.matchMedia("(display-mode: standalone)").matches ||
          // iOS Safari 舊版只認這個非標準屬性
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      })
    );
    setBannerDismissed(readDismissed());
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 存不了就只在這次 session 關掉
    }
  }, []);

  const canGuide = state === "ios-browser" || state === "ios-in-app";

  return { state, canGuide, bannerDismissed, dismissBanner };
}
