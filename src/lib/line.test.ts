import { describe, it, expect } from "vitest";
import { buildStudentMenuFlex } from "./line";

// The student menu's LIFF button URLs are the contract the flex message (and
// later the Rich Menu) depends on, so pin them down.

interface UriButton {
  type: string;
  action?: { type: string; label: string; uri: string };
}

function buttonsOf(flex: ReturnType<typeof buildStudentMenuFlex>): UriButton[] {
  // contents.body.contents = [title, subtitle, ...buttons]
  const contents = flex.contents as { body: { contents: UriButton[] } };
  return contents.body.contents.filter((c) => c.type === "button");
}

describe("buildStudentMenuFlex", () => {
  it("exposes 上課簽到 / 我的課卡 / 購買課卡 as LIFF uri buttons", () => {
    const buttons = buttonsOf(buildStudentMenuFlex());
    const uriButtons = buttons.filter((b) => b.action?.type === "uri");

    expect(uriButtons).toHaveLength(3);
    const labels = uriButtons.map((b) => b.action!.label);
    expect(labels).toEqual(["上課簽到", "瀏覽我的課卡", "購買課卡"]);

    const uris = uriButtons.map((b) => b.action!.uri);
    expect(uris[0]).toMatch(/\/checkin$/);
    expect(uris[1]).toMatch(/\/cards$/);
    expect(uris[2]).toMatch(/\/buy$/);
  });

  it("adds a 切換到老師 postback button only when showSwitch", () => {
    const without = buttonsOf(buildStudentMenuFlex());
    expect(without.some((b) => b.action?.type === "postback")).toBe(false);

    const withSwitch = buttonsOf(buildStudentMenuFlex({ showSwitch: true }));
    const postbacks = withSwitch.filter((b) => b.action?.type === "postback");
    expect(postbacks).toHaveLength(1);
    expect(postbacks[0].action!.label).toBe("切換到老師");
  });
});
