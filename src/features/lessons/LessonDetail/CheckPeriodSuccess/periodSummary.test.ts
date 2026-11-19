import { describe, it, expect } from "vitest";
import { headcountDeltaLabel, renewalCandidates, summaryHeadline } from "./periodSummary";

describe("summaryHeadline", () => {
  it("celebrates a full house only right after submitting", () => {
    expect(summaryHeadline({ justSubmitted: true, attended: 8, absent: 0 })).toBe("全員到齊！");
    expect(summaryHeadline({ justSubmitted: true, attended: 6, absent: 2 })).toBe("點名完成");
    expect(summaryHeadline({ justSubmitted: true, attended: 0, absent: 0 })).toBe("點名完成");
    expect(summaryHeadline({ justSubmitted: false, attended: 8, absent: 0 })).toBe("點名紀錄");
  });
});

describe("headcountDeltaLabel", () => {
  const taken = [
    { periodId: 1, attended: 5 },
    { periodId: 2, attended: 8 },
    { periodId: 3, attended: 8 },
    { periodId: 4, attended: 6 },
  ];

  it("compares with the previous taken period, whichever week it was", () => {
    expect(headcountDeltaLabel(taken, 2)).toBe("比上一堂多 3 人");
    expect(headcountDeltaLabel(taken, 3)).toBe("跟上一堂一樣多");
    expect(headcountDeltaLabel(taken, 4)).toBe("比上一堂少 2 人");
  });

  it("has nothing to say for the first period or an unknown one", () => {
    expect(headcountDeltaLabel(taken, 1)).toBeNull();
    expect(headcountDeltaLabel(taken, 99)).toBeNull();
  });
});

describe("renewalCandidates", () => {
  const record = (studentId: number, extra: object) => ({
    studentId,
    studentName: `S${studentId}`,
    studentAvatarUrl: "/a.png",
    ...extra,
  });
  const records = [
    record(1, { cardName: "進階6堂", remainingSessions: 0 }),
    record(2, { cardName: "進階6堂", remainingSessions: 3 }),
    record(3, { cardName: null, remainingSessions: 0 }),
    record(4, { dropIn: { id: 1 } }),
  ];

  it("lists who just used up a card", () => {
    expect(renewalCandidates(records, true)).toEqual([
      { studentId: 1, studentName: "S1", studentAvatarUrl: "/a.png", cardName: "進階6堂" },
    ]);
  });

  it("says nothing on an older period — the remaining count is today's, not that day's", () => {
    expect(renewalCandidates(records, false)).toEqual([]);
  });
});
