import { isMockLiff } from "@/lib/liffClient";

const OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID ?? "";

/** The official account's id (`@xxx`), or a fake one inside the LINE simulator; "" when unset. */
export function lineOaId(): string {
  return OA_ID || (isMockLiff() ? "@googoocard-mock" : "");
}

/**
 * Deep link straight into the official account's chat (where the rich menu lives).
 * For someone who isn't a friend yet LINE asks them to add it first. null when the OA id is unset.
 */
export function lineOaChatUrl(): string | null {
  const id = lineOaId();
  return id ? `https://line.me/R/oaMessage/${encodeURIComponent(id)}/` : null;
}

/** The add-friend / profile page. null when the OA id is unset. */
export function lineOaAddFriendUrl(): string | null {
  const id = lineOaId();
  return id ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : null;
}
