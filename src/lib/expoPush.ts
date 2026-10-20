// Expo Push Service 的薄包裝：App（mobile/）用 expo-notifications 拿到的
// `ExponentPushToken[...]` 都經由這裡發送，iOS 由 Expo 轉給 APNs、Android 轉給 FCM。
// https://docs.expo.dev/push-notifications/sending-notifications/
//
// 只負責 HTTP；誰該收、要不要發由 src/service/push.ts 決定。

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo 規定一次最多 100 則。
const CHUNK_SIZE = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: "default";
};

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

const TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

export function isExpoPushToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** 回傳的 tickets 與 `messages` 一一對應（同順序）。HTTP 失敗會 throw。 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // 有在 Expo 後台開「Enhanced push security」才需要；沒設就不帶。
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`Expo push failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: ExpoPushTicket[] };
    tickets.push(...json.data);
  }
  return tickets;
}
