import { describe, it, expect } from "vitest";
import { buildStudentMenuFlex } from "./line";

// The student menu's LIFF action URLs are the contract the flex message (and
// later the Rich Menu) depends on, so pin them down. Each menu entry is an
// icon-row box with the action bound to the box itself.

interface Action {
  type: string;
  label: string;
  uri?: string;
  data?: string;
}

function actionsOf(flex: ReturnType<typeof buildStudentMenuFlex>): Action[] {
  // contents.body.contents = [row, separator, row, separator, ...]
  const contents = flex.contents as {
    body: { contents: { type: string; action?: Action }[] };
  };
  return contents.body.contents
    .filter((c) => c.type === "box" && c.action)
    .map((c) => c.action!);
}

describe("buildStudentMenuFlex", () => {
  it("exposes 上課簽到 / 我的課卡 / 購買課卡 as LIFF uri actions", () => {
    const uriActions = actionsOf(buildStudentMenuFlex()).filter((a) => a.type === "uri");

    expect(uriActions).toHaveLength(3);
    const labels = uriActions.map((a) => a.label);
    expect(labels).toEqual(["上課簽到", "瀏覽我的課卡", "購買課卡"]);

    const uris = uriActions.map((a) => a.uri);
    expect(uris[0]).toMatch(/\/checkin$/);
    expect(uris[1]).toMatch(/\/cards$/);
    expect(uris[2]).toMatch(/\/buy$/);
  });

  it("adds a 切換到老師 postback action only when showSwitch", () => {
    const without = actionsOf(buildStudentMenuFlex());
    expect(without.some((a) => a.type === "postback")).toBe(false);

    const withSwitch = actionsOf(buildStudentMenuFlex({ showSwitch: true }));
    const postbacks = withSwitch.filter((a) => a.type === "postback");
    expect(postbacks).toHaveLength(1);
    expect(postbacks[0].label).toBe("切換到老師");
  });
});
