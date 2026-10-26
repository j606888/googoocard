import { describe, expect, it } from "vitest";
import { cardEndReason, cardPeriodLabel, isCardEnded, shortDate } from "./cardStatus";

const now = new Date("2026-10-13T12:00:00+08:00");

describe("cardStatus", () => {
  it("用完或停用的卡算已結束", () => {
    expect(isCardEnded({ remainingSessions: 0, expiredAt: null })).toBe(true);
    expect(isCardEnded({ remainingSessions: 3, expiredAt: "2026-09-01T00:00:00Z" })).toBe(true);
    expect(isCardEnded({ remainingSessions: 3, expiredAt: null })).toBe(false);
  });

  it("結束原因：先看轉換，再看用完，其餘是停用", () => {
    expect(cardEndReason({ remainingSessions: 0, convertedTo: { serialNumber: 30 } })).toBe("已轉換 → #A0030");
    expect(cardEndReason({ remainingSessions: 0, convertedTo: null })).toBe("用完");
    expect(cardEndReason({ remainingSessions: 2, convertedTo: null })).toBe("已停用");
  });

  it("轉讓：寫出轉了幾堂、給誰；公開頁沒有名字就只寫編號", () => {
    expect(
      cardEndReason({ remainingSessions: 4, transferredTo: { serialNumber: 42, student: { name: "李彥增" } } })
    ).toBe("已轉讓 4 堂 → 李彥增 #A0042");
    expect(cardEndReason({ remainingSessions: 4, transferredTo: { serialNumber: 42 } })).toBe("已轉讓 4 堂 → #A0042");
  });

  it("今年省略年份，其他年份帶年份", () => {
    expect(shortDate("2026-07-02T10:00:00+08:00", now)).toBe("7/2");
    expect(shortDate("2025-12-01T10:00:00+08:00", now)).toBe("2025/12/1");
  });

  it("期間取購買日到停用日，沒停用就到最後一次扣卡", () => {
    const base = { createdAt: "2026-07-02T10:00:00+08:00" };
    expect(
      cardPeriodLabel(
        {
          ...base,
          expiredAt: null,
          attendanceRecords: [
            { periodStartTime: "2026-09-24T19:00:00+08:00" },
            { periodStartTime: "2026-08-01T19:00:00+08:00" },
          ],
        },
        now
      )
    ).toBe("7/2 – 9/24");
    expect(
      cardPeriodLabel(
        { ...base, expiredAt: "2026-10-01T10:00:00+08:00", attendanceRecords: [{ periodStartTime: "2026-09-24T19:00:00+08:00" }] },
        now
      )
    ).toBe("7/2 – 10/1");
    expect(cardPeriodLabel({ ...base, expiredAt: null, attendanceRecords: [] }, now)).toBe("7/2");
    expect(
      cardPeriodLabel({ ...base, expiredAt: null, attendanceRecords: [{ periodStartTime: "2026-07-02T19:00:00+08:00" }] }, now)
    ).toBe("7/2");
  });
});
