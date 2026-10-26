import definition from "./lineRichMenu.json";

/**
 * 官方帳號的 Rich Menu：一張、所有人共用（設成預設選單），只給學生用——老師用網站。Each area names its
 * action by code — `liff:<path>` opens a LIFF page, `postback:<action>` asks the
 * bot (src/service/lineBot.ts BOT_ACTIONS) to answer in the chat — so the same
 * JSON drives provisioning (scripts/provision-line-richmenu.mjs), the image
 * (scripts/generate-richmenu.mjs) and the /dev/line simulator.
 */
export type RichMenuArea = {
  label: string;
  action: string;
  /** lucide icon name — image only. */
  icon: string;
  /** Second line on the big first tile — image only. */
  hint?: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export const RICH_MENU = definition as {
  name: string;
  chatBarText: string;
  size: { width: number; height: number };
  areas: RichMenuArea[];
};

/** Published image, also shown by the simulator. */
export const RICH_MENU_IMAGE = "/images/richmenu/main.png";

export type RichMenuAction =
  | { type: "uri"; label: string; uri: string }
  | { type: "postback"; label: string; data: string; displayText: string };

/** An area's LINE action. `liffUri(path)` = src/lib/line.ts `liffPath`. */
export function richMenuAction(area: RichMenuArea, liffUri: (path: string) => string): RichMenuAction {
  const [kind, target] = area.action.split(":");
  if (kind === "liff") return { type: "uri", label: area.label, uri: liffUri(target) };
  return { type: "postback", label: area.label, data: `a=${target}`, displayText: area.label };
}
