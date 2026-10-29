import { isLineMockEnabled } from "@/lib/lineMock";

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

export type LineProfile = { displayName: string; pictureUrl?: string };

/**
 * A LINE user's display name and picture, via the Messaging API — for the
 * webhook, which (unlike LIFF's ID token) only carries the userId. LINE only
 * answers for users who've added the official account as a friend, so this is
 * best-effort: any failure is null and the caller binds without a name.
 * https://developers.line.biz/en/reference/messaging-api/#get-profile
 */
export async function fetchLineProfile(lineUserId: string): Promise<LineProfile | null> {
  if (!CHANNEL_ACCESS_TOKEN) return null;
  // /dev/line personas don't exist on LINE's side.
  if (isLineMockEnabled() && lineUserId.startsWith("Umock")) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[line] profile lookup failed: ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { displayName?: string; pictureUrl?: string };
    return body.displayName ? { displayName: body.displayName, pictureUrl: body.pictureUrl } : null;
  } catch (e) {
    console.warn("[line] profile lookup threw", e);
    return null;
  }
}

// LINE serves profile pictures from both hosts (sprofile = newer accounts).
export const LINE_PICTURE_PREFIXES = [
  "https://profile.line-scdn.net/",
  "https://sprofile.line-scdn.net/",
] as const;
export const PRESET_AVATAR_PREFIX = "/images/avatars/";

/** A LINE profile picture (set from LINE, so it goes when the LINE binding goes). */
export const isLinePicture = (avatarUrl: string) =>
  LINE_PICTURE_PREFIXES.some((prefix) => avatarUrl.startsWith(prefix));

/**
 * May LINE's picture replace this avatar? Yes for a built-in preset or an older
 * LINE picture; never for a photo a teacher uploaded on purpose.
 */
export const isReplaceableByLinePicture = (avatarUrl: string) =>
  avatarUrl.startsWith(PRESET_AVATAR_PREFIX) || isLinePicture(avatarUrl);
