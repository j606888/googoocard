import { describe, expect, it } from "vitest";
import { RICH_MENU, richMenuAction } from "./lineRichMenu";
import { BOT_ACTIONS } from "@/service/lineBot";

describe("rich menu definition", () => {
  const { width, height } = RICH_MENU.size;

  it("is a size LINE accepts", () => {
    expect([width, height]).toEqual([2500, 1686]);
  });

  it("areas tile the whole canvas without overlapping", () => {
    let covered = 0;
    for (const { bounds: b } of RICH_MENU.areas) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      covered += b.width * b.height;
    }
    expect(covered).toBe(width * height);
    for (const [i, a] of RICH_MENU.areas.entries()) {
      for (const b of RICH_MENU.areas.slice(i + 1)) {
        const overlap =
          a.bounds.x < b.bounds.x + b.bounds.width &&
          b.bounds.x < a.bounds.x + a.bounds.width &&
          a.bounds.y < b.bounds.y + b.bounds.height &&
          b.bounds.y < a.bounds.y + a.bounds.height;
        expect(overlap, `${a.label} overlaps ${b.label}`).toBe(false);
      }
    }
  });

  it("every postback is an action the bot handles; LIFF areas open real pages", () => {
    for (const area of RICH_MENU.areas) {
      const action = richMenuAction(area, (p) => `https://liff.line.me/ID/${p}`);
      if (action.type === "postback") {
        expect(BOT_ACTIONS).toContain(new URLSearchParams(action.data).get("a"));
        expect(action.displayText).toBe(area.label);
      } else {
        expect(["checkin", "schedule", "plans"]).toContain(action.uri.split("/").pop());
      }
      // LINE caps action labels at 20 chars.
      expect(area.label.length).toBeLessThanOrEqual(20);
    }
  });
});
