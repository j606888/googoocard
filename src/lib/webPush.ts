// 標準 Web Push（VAPID）的薄包裝：網頁版的推播經由瀏覽器自己的推播服務送達
// （Chrome → FCM、Safari → Apple、Firefox → Mozilla），不用註冊任何第三方帳號。
// iPhone 要把網站「加到主畫面」（iOS 16.4+）才收得到。
//
// 只負責送出；誰該收、要不要發由 src/service/push.ts 決定。
import webpush from "web-push";
import { CONTACT_EMAIL } from "@/lib/legal";

export type WebPushTarget = { endpoint: string; p256dh: string; auth: string };

export type WebPushPayload = {
  title: string;
  body: string;
  /** 點通知後開的站內網址（public/sw.js 會照開）。 */
  url: string;
  /** 主畫面圖示上的數字（支援 Badging API 的瀏覽器）。 */
  badge?: number;
  /** 同一個 tag 的通知會取代舊的，不會疊一堆。 */
  tag?: string;
};

/** 兩把 VAPID 金鑰都設了才發；沒設（本機、測試）就整個跳過。 */
export function webPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    `mailto:${CONTACT_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

/**
 * 送一則。回傳 `"gone"` 表示這個訂閱已經失效（使用者關掉通知、清掉網站資料、
 * 換了瀏覽器），呼叫端應該刪掉它；其他錯誤回 `"error"`，訂閱留著下次再試。
 */
export async function sendWebPush(
  target: WebPushTarget,
  payload: WebPushPayload
): Promise<"ok" | "gone" | "error"> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      // 一天內沒送到就算了：待處理清單本來就會一直列著。
      { TTL: 24 * 60 * 60, urgency: "high" }
    );
    return "ok";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[webPush] send failed", status, error);
    return "error";
  }
}
