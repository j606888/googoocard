import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import {
  archiveEntry,
  archivedEvent,
  diffEntry,
  editCount,
  editEntry,
  entryValues,
  isArchived,
  lastTouched,
  originalValues,
  restoreEntry,
  stampTime,
} from "./ledgerHistory";

const tx: Transaction = {
  id: 1,
  date: "10/23",
  category: "飲料",
  description: "礦泉水兩箱",
  branch: "高雄",
  holder: "老師 B · 現金",
  amount: -380,
  history: [{ type: "created", by: "老師 B", at: "10/23 21:15" }],
};

const ding = (at: string) => ({ by: "丁丁", at });

describe("diffEntry", () => {
  it("只列出有變的欄位", () => {
    const changes = diffEntry(entryValues(tx), { ...entryValues(tx), amount: -360, branch: "台南" });
    expect(changes).toEqual([
      { field: "amount", from: -380, to: -360 },
      { field: "branch", from: "高雄", to: "台南" },
    ]);
  });

  it("沒改東西就是空的", () => {
    expect(diffEntry(entryValues(tx), entryValues(tx))).toEqual([]);
  });
});

describe("editEntry", () => {
  it("改掉欄位，並把改了什麼、誰、為什麼記進歷程", () => {
    const edited = editEntry(tx, { ...entryValues(tx), amount: -360 }, ding("10/24 09:12"), "收據上是 360");
    expect(edited.amount).toBe(-360);
    expect(edited.history).toHaveLength(2);
    expect(edited.history[1]).toEqual({
      type: "edited",
      by: "丁丁",
      at: "10/24 09:12",
      reason: "收據上是 360",
      changes: [{ field: "amount", from: -380, to: -360 }],
    });
    expect(editCount(edited)).toBe(1);
    expect(lastTouched(edited)).toBe(edited.history[1]);
  });

  it("改了好幾次，原本的內容還是倒推得回來", () => {
    const once = editEntry(tx, { ...entryValues(tx), amount: -360 }, ding("10/24 09:12"), "打錯");
    const twice = editEntry(once, { ...entryValues(once), amount: -350, description: "練習夜 礦泉水" }, ding("10/24 10:00"), "又打錯");
    expect(originalValues(twice)).toEqual(entryValues(tx));
    expect(editCount(twice)).toBe(2);
  });
});

describe("archive / restore", () => {
  it("封存之後還原，歷程三筆都在", () => {
    const archived = archiveEntry(tx, ding("10/23 21:20"), "重複記了");
    expect(isArchived(archived)).toBe(true);
    expect(archivedEvent(archived)?.reason).toBe("重複記了");

    const restored = restoreEntry(archived, ding("10/24 08:00"));
    expect(isArchived(restored)).toBe(false);
    expect(restored.history.map((e) => e.type)).toEqual(["created", "archived", "restored"]);
  });

  it("還原後再封存，算最後那次", () => {
    const again = archiveEntry(restoreEntry(archiveEntry(tx, ding("1"), "a"), ding("2")), ding("3"), "b");
    expect(archivedEvent(again)?.reason).toBe("b");
  });

  it("沒動過的不算封存，也沒有最後修改", () => {
    expect(isArchived(tx)).toBe(false);
    expect(lastTouched(tx)).toBeUndefined();
  });
});

describe("stampTime", () => {
  it("同一天只顯示時間，補記的連日期", () => {
    expect(stampTime({ by: "x", at: "10/23 21:15" }, "10/23")).toBe("21:15");
    expect(stampTime({ by: "x", at: "10/18 10:16" }, "10/17")).toBe("10/18 10:16");
  });
});
