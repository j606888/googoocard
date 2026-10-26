import { describe, expect, it } from "vitest";
import type { StudentCardWithCard } from "@/store/slices/students";
import { buildCardTimeline } from "./cardTimeline";

const base = {
  id: 1,
  serialNumber: 1,
  studentId: 1,
  cardId: 1,
  basePrice: 3000,
  finalPrice: 3000,
  totalSessions: 6,
  remainingSessions: 6,
  purchaseSource: "STAFF",
  note: null,
  origin: "PURCHASE",
  convertedToId: null,
  isPaid: true,
  paidAt: "2026-10-01T10:00:00Z",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  expiredAt: null,
  attendanceRecords: [],
  card: { id: 1, name: "一般課卡 6 堂" },
} as unknown as StudentCardWithCard;

describe("buildCardTimeline", () => {
  it("新的在前；建卡時就收款的不另列收款", () => {
    const timeline = buildCardTimeline({
      ...base,
      attendanceRecords: [
        { lessonName: "Bachata", periodStartTime: Date.parse("2026-10-08T11:30:00Z"), source: "TEACHER", pending: false },
        { lessonName: "Bachata", periodStartTime: Date.parse("2026-10-15T11:30:00Z"), source: "STUDENT", pending: true },
      ],
    });
    expect(timeline.map((e) => e.kind)).toEqual(["use", "use", "purchase"]);
  });

  it("之後才收款的另列一筆收款", () => {
    const timeline = buildCardTimeline({ ...base, paidAt: "2026-10-03T10:00:00Z" });
    expect(timeline.map((e) => e.kind)).toEqual(["payment", "purchase"]);
  });

  it("轉讓轉入的卡從「轉入」開始；轉讓出去的卡以「轉讓」結束", () => {
    expect(buildCardTimeline({ ...base, origin: "TRANSFER" }).map((e) => e.kind)).toEqual(["transferredIn"]);
    const out = buildCardTimeline({
      ...base,
      remainingSessions: 4,
      expiredAt: "2026-10-20T10:00:00Z",
      transferredTo: { id: 9, serialNumber: 42, totalSessions: 4 },
    });
    expect(out.map((e) => e.kind)).toEqual(["transferredOut", "purchase"]);
  });

  it("用完不另列結束；停用要列", () => {
    expect(buildCardTimeline({ ...base, remainingSessions: 0 }).map((e) => e.kind)).toEqual(["purchase"]);
    expect(
      buildCardTimeline({ ...base, remainingSessions: 2, expiredAt: "2026-10-20T10:00:00Z" }).map((e) => e.kind)
    ).toEqual(["expired", "purchase"]);
  });
});
