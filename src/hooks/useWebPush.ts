"use client";

import { useCallback, useEffect, useState } from "react";
import { useInstallState } from "@/hooks/useInstallState";

/**
 * 這個瀏覽器的網頁推播（伺服器端見 src/lib/webPush.ts）。
 *
 * - `unsupported`   — 瀏覽器不支援，或伺服器沒設 VAPID 金鑰
 * - `needs-install` — iPhone／iPad 的瀏覽器分頁：要先加到主畫面才收得到（iOS 16.4+）
 * - `denied`        — 使用者在瀏覽器擋掉了通知，只能到瀏覽器設定打開
 * - `off` / `on`    — 這個瀏覽器有沒有在收
 */
export type WebPushStatus = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const ENDPOINT = "/api/web-push-subscriptions";

function supported(): boolean {
  return (
    Boolean(VAPID_PUBLIC_KEY) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID 公鑰是 base64url，PushManager 要 bytes。
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function saveSubscription(subscription: PushSubscription) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error(`save subscription: ${res.status}`);
}

/**
 * 登出前呼叫：這個瀏覽器不要再收到這個帳號的通知。失敗就算了，不擋登出。
 */
export async function disableWebPushOnLogout(): Promise<void> {
  try {
    if (!supported()) return;
    const subscription = await currentSubscription();
    if (!subscription) return;
    await fetch(ENDPOINT, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch {
    // 不擋登出
  }
}

export function useWebPush() {
  const install = useInstallState();
  const [status, setStatus] = useState<WebPushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (install.state === "unknown") return;
    if (!supported()) {
      setStatus(install.canGuide ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    currentSubscription()
      .then(async (subscription) => {
        if (!subscription) return setStatus("off");
        // 再交一次：同一個瀏覽器換了帳號登入時，訂閱要改掛到現在這個人身上。
        await saveSubscription(subscription).catch(() => {});
        setStatus("on");
      })
      .catch(() => setStatus("off"));
  }, [install.state, install.canGuide]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return false;
      }
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!),
        }));
      await saveSubscription(subscription);
      setStatus("on");
      return true;
    } catch (error) {
      console.error("[webPush] enable failed", error);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    await disableWebPushOnLogout();
    setStatus("off");
    setBusy(false);
  }, []);

  return { status, busy, enable, disable };
}
