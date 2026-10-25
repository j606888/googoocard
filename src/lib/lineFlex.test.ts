import { describe, expect, it } from "vitest";
import {
  groupByTaipeiDay,
  MAX_ROWS_PER_DAY,
  myCardsFlex,
  priceListFlex,
  quickReplyText,
  scheduleCarousel,
  type SchedulePeriod,
} from "./lineFlex";

const period = (iso: string, name = "Bachata Lv1"): SchedulePeriod => ({
  startTime: new Date(iso),
  endTime: new Date(new Date(iso).getTime() + 3600_000),
  lessonName: name,
  styleLabel: "Bachata",
  teacherNames: ["林老師"],
  locationName: "台南",
});

const json = (v: unknown) => JSON.stringify(v);

describe("groupByTaipeiDay", () => {
  it("groups by Taipei calendar day, not UTC", () => {
    // 2026-10-27 23:30 Taipei = 15:30Z; 2026-10-28 00:30 Taipei = 16:30Z.
    const days = groupByTaipeiDay([period("2026-10-27T16:30:00Z", "B"), period("2026-10-27T15:30:00Z", "A")]);
    expect(days.map((d) => d.label)).toEqual(["10/27（二）", "10/28（三）"]);
    expect(days[0].periods[0].lessonName).toBe("A");
  });
});

describe("scheduleCarousel", () => {
  it("one bubble per day, truncating long days with 「還有 N 堂」", () => {
    const busy = Array.from({ length: MAX_ROWS_PER_DAY + 2 }, (_, i) =>
      period(`2026-10-27T${String(i + 1).padStart(2, "0")}:00:00Z`)
    );
    const msg = scheduleCarousel({
      classroomName: "Googoo",
      locationName: null,
      days: groupByTaipeiDay([...busy, period("2026-10-29T12:00:00Z")]),
    }) as { contents: { type: string; contents: unknown[] } };
    expect(msg.contents.type).toBe("carousel");
    expect(msg.contents.contents).toHaveLength(2);
    expect(json(msg)).toContain("還有 2 堂");
    // All locations → rows name their 分部.
    expect(json(msg)).toContain("台南");
  });

  it("filtered to one location: map button, rows omit the location", () => {
    const msg = scheduleCarousel({
      classroomName: "Googoo",
      locationName: "高雄",
      days: groupByTaipeiDay([{ ...period("2026-10-27T12:00:00Z"), locationName: "高雄" }]),
      mapUri: "https://maps.example/x",
    });
    expect(json(msg)).toContain("https://maps.example/x");
    expect(json(msg)).toContain("高雄 課表");
    expect(json(msg)).not.toContain("林老師 · 高雄");
  });

  it("empty week → plain text", () => {
    expect(scheduleCarousel({ classroomName: "Googoo", locationName: "台南", days: [] })).toEqual({
      type: "text",
      text: "Googoo（台南）未來一週沒有排課。",
    });
  });
});

describe("priceListFlex", () => {
  it("drops empty groups, shows per-session price and 免費", () => {
    const msg = priceListFlex({
      classroomName: "Googoo",
      groups: [
        { title: "課卡", cards: [{ name: "10 堂卡", sessions: 10, price: 4500 }] },
        { title: "複習卡", cards: [] },
        { title: "體驗課", cards: [{ name: "體驗", sessions: 1, price: 0 }] },
      ],
      buyUri: "https://liff/buy",
    }) as { contents: { type: string; contents: unknown[] } };
    expect(msg.contents.type).toBe("carousel");
    expect(msg.contents.contents).toHaveLength(2);
    expect(json(msg)).toContain("單堂 $450");
    expect(json(msg)).toContain("免費");
    expect(json(msg)).toContain("https://liff/buy");
  });

  it("no cards → text", () => {
    expect(priceListFlex({ classroomName: "G", groups: [] })).toMatchObject({ type: "text" });
  });
});

describe("myCardsFlex", () => {
  it("lists remaining sessions and sums what's owed", () => {
    const msg = myCardsFlex({
      studentName: "小美",
      classroomName: "Googoo",
      cards: [
        { name: "10 堂卡", serial: "#A0001", remainingSessions: 3, totalSessions: 10, unpaidAmount: null },
        { name: "4 堂卡", serial: "#A0002", remainingSessions: 4, totalSessions: 4, unpaidAmount: 2000 },
      ],
      cardsUri: "c",
      buyUri: "b",
    });
    expect(json(msg)).toContain("剩 3／10 堂");
    expect(json(msg)).toContain("尚未付款 $2,000");
    expect(json(msg)).not.toContain("切換學生");
  });

  it("empty state still offers buying", () => {
    const msg = myCardsFlex({ studentName: "小美", classroomName: "G", cards: [], cardsUri: "c", buyUri: "b", switchUri: "s" });
    expect(json(msg)).toContain("目前沒有可以用的課卡");
    expect(json(msg)).toContain("切換學生");
  });
});

describe("quickReplyText", () => {
  it("caps labels at 20 chars and items at 13", () => {
    const msg = quickReplyText(
      "pick",
      Array.from({ length: 20 }, (_, i) => ({ label: `教室名稱很長很長很長很長很長很長很長很長${i}`, data: `a=pick&c=${i}` }))
    ) as { quickReply: { items: { action: { label: string } }[] } };
    expect(msg.quickReply.items).toHaveLength(13);
    expect(msg.quickReply.items[0].action.label.length).toBeLessThanOrEqual(20);
  });
});
