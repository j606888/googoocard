import { describe, expect, it } from "vitest";
import type { Event } from "@/store/slices/students";
import { buildTimelineRows, dayLabel, filterByCategory, groupByDay, presentEvent, relativeDayLabel } from "./EventTimeline.helpers";

const now = new Date("2026-10-13T12:00:00+08:00");
let nextId = 1;
const ev = (title: string, description: string, createdAt: string): Event => ({
  id: nextId++,
  title,
  description,
  createdAt,
  resourceType: "x",
  resourceId: 0,
});

describe("EventTimeline.helpers", () => {
  it("簽到事件從說明推出課名當標題", () => {
    const shown = presentEvent(ev("簽到", "Bachata Lv2 簽到成功", "2026-10-08T19:24:00+08:00"));
    expect(shown.title).toBe("上課：Bachata Lv2");
    expect(shown.description).toBeNull();
  });

  it("課卡事件去掉重複的前綴", () => {
    expect(presentEvent(ev("購買課卡", "購買新課卡 8 堂卡", "2026-10-01T00:00:00Z")).description).toBe("8 堂卡");
    expect(presentEvent(ev("課卡使用完畢", "課卡 8 堂卡 使用完畢", "2026-10-01T00:00:00Z")).description).toBe("8 堂卡");
    expect(presentEvent(ev("確認付款", "確認付款 8 堂卡（$3600）", "2026-10-01T00:00:00Z")).description).toBe("8 堂卡（$3600）");
  });

  it("分類：課卡含購買／付款／用完／轉換，上課只有簽到", () => {
    const events = [
      ev("購買課卡", "", "2026-10-01T00:00:00Z"),
      ev("確認付款", "", "2026-10-01T00:00:00Z"),
      ev("課卡轉換", "", "2026-10-01T00:00:00Z"),
      ev("簽到", "", "2026-10-01T00:00:00Z"),
    ];
    expect(filterByCategory(events, "card")).toHaveLength(3);
    expect(filterByCategory(events, "lesson")).toHaveLength(1);
  });

  it("日期標題：今年不帶年份，近 30 天有相對天數", () => {
    expect(dayLabel("2026-10-08T19:00:00+08:00", now)).toBe("10 月 8 日 週四");
    expect(dayLabel("2025-03-12T19:00:00+08:00", now)).toBe("2025 年 3 月 12 日 週三");
    expect(relativeDayLabel("2026-10-08T19:00:00+08:00", now)).toBe("5 天前");
    expect(relativeDayLabel("2026-10-13T09:00:00+08:00", now)).toBe("今天");
    expect(relativeDayLabel("2026-08-01T09:00:00+08:00", now)).toBeNull();
  });

  it("同一天的用完事件收到簽到下面，並依日分組", () => {
    const exhausted = ev("課卡使用完畢", "課卡 單堂 使用完畢", "2026-10-08T19:25:00+08:00");
    const checkin = ev("簽到", "Bachata Lv2 簽到成功", "2026-10-08T19:24:00+08:00");
    const purchase = ev("購買課卡", "購買新課卡 單堂", "2026-10-07T10:00:00+08:00");
    const groups = groupByDay(buildTimelineRows([exhausted, checkin, purchase]), now);
    expect(groups.map((g) => g.rows.length)).toEqual([1, 1]);
    expect("checkin" in groups[0].rows[0]).toBe(true);
    expect(groups[0].relative).toBe("5 天前");
  });
});
