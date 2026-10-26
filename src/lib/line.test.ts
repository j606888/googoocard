import { describe, it, expect } from "vitest";
import { buildRenewalReminderFlex, buildStudentMenuFlex } from "./line";

// The student menu's LIFF action URLs are the contract the flex message (and
// later the Rich Menu) depends on, so pin them down. Each menu entry is an
// icon-row box with the action bound to the box itself.

interface Action {
  type: string;
  label: string;
  uri?: string;
  data?: string;
}

function actionsOf(flex: Record<string, unknown>): Action[] {
  // contents.body.contents = [row, separator, row, separator, ...]
  const contents = flex.contents as {
    body: { contents: { type: string; action?: Action }[] };
  };
  return contents.body.contents
    .filter((c) => c.type === "box" && c.action)
    .map((c) => c.action!);
}

describe("buildStudentMenuFlex", () => {
  it("exposes 上課簽到 / 我的課卡 / 課表 / 課卡方案 as LIFF uri actions", () => {
    const actions = actionsOf(buildStudentMenuFlex());
    expect(actions.every((a) => a.type === "uri")).toBe(true);
    expect(actions.map((a) => a.label)).toEqual(["上課簽到", "我的課卡", "課表", "課卡方案"]);
    expect(actions.map((a) => a.uri?.split("/").pop())).toEqual(["checkin", "cards", "schedule", "plans"]);
  });

  it("adds 切換教室 (the LIFF picker) only when bound to several students", () => {
    expect(actionsOf(buildStudentMenuFlex()).some((a) => a.label === "切換教室")).toBe(false);
    const switchAction = actionsOf(buildStudentMenuFlex({ showStudentSwitch: true })).find((a) => a.label === "切換教室");
    expect(switchAction?.uri).toMatch(/\/cards\?switch=1$/);
  });
});

describe("buildRenewalReminderFlex", () => {
  it("只給一個通往 LIFF 購卡頁的按鈕，並在說明裡帶上卡名", () => {
    const flex = buildRenewalReminderFlex({ name: "小明", cardName: "六堂卡" });

    expect(flex.altText).toBe("續卡提醒");

    const actions = actionsOf(flex);
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe("購買課卡");
    expect(actions[0].uri).toMatch(/\/plans$/);

    // 說明段落是 rows 的第一個 box（沒有 action），和按鈕列分開。
    const body = (flex.contents as { body: { contents: Record<string, unknown>[] } }).body;
    const lead = JSON.stringify(body.contents[0]);
    expect(lead).toContain("小明");
    expect(lead).toContain("六堂卡");
  });

  it("沒有名字與卡名時仍然說得通", () => {
    const flex = buildRenewalReminderFlex({});
    const body = (flex.contents as { body: { contents: Record<string, unknown>[] } }).body;
    expect(JSON.stringify(body.contents[0])).toContain("課卡");
    expect(actionsOf(flex)).toHaveLength(1);
  });
});
