import {
  encodeMockToken,
  isLineMockEnabled,
  MOCK_CLOSE_MESSAGE,
  MOCK_FRAME_PREFIX,
  type MockLineUser,
} from "@/lib/lineMock";

/** The slice of the LIFF SDK the student pages use. */
export type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getIDToken: () => string | null;
  isInClient: () => boolean;
  closeWindow: () => void;
  /** Whether this user has added the linked official account as a friend. */
  getFriendship: () => Promise<{ friendFlag: boolean }>;
  /** Whether an optional API (e.g. "scanCodeV2") works here. Absent in the simulator. */
  isApiAvailable?: (api: string) => boolean;
  /** LINE's QR scanner — needs「Scan QR」enabled in the LIFF app's settings. */
  scanCodeV2?: () => Promise<{ value: string | null }>;
};

// The persona the /dev/line simulator put on this frame, if any.
function mockPersona(): MockLineUser | null {
  if (!isLineMockEnabled() || typeof window === "undefined") return null;
  if (!window.name.startsWith(MOCK_FRAME_PREFIX)) return null;
  try {
    return JSON.parse(window.name.slice(MOCK_FRAME_PREFIX.length)) as MockLineUser;
  } catch {
    return null;
  }
}

function mockLiff(user: MockLineUser): LiffClient {
  return {
    init: async () => {},
    isLoggedIn: () => true,
    login: () => {},
    getIDToken: () => encodeMockToken(user),
    isInClient: () => true,
    // The simulator shows a "closed" screen instead of a real window close.
    closeWindow: () => window.parent.postMessage({ type: MOCK_CLOSE_MESSAGE }, window.location.origin),
    getFriendship: async () => ({ friendFlag: user.isFriend ?? false }),
  };
}

/** True inside the /dev/line simulator's phone frame. */
export function isMockLiff() {
  return mockPersona() !== null;
}

/** The LIFF ID to init with — inside the simulator any value works. */
export function getLiffId() {
  return mockPersona() ? "mock" : process.env.NEXT_PUBLIC_LIFF_ID;
}

/** The LINE LIFF SDK, or a fake one when opened inside the /dev/line simulator. */
export async function loadLiff(): Promise<LiffClient> {
  const persona = mockPersona();
  if (persona) return mockLiff(persona);
  return (await import("@line/liff")).default;
}
