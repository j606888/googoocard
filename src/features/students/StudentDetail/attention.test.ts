import { describe, it, expect } from "vitest";
import { subDays } from "date-fns";
import type { StudentWithDetail } from "@/store/slices/students";
import { attentionFor } from "./attention";

const NOW = new Date("2026-10-26T12:00:00");

const card = (over: Partial<{ isPaid: boolean; finalPrice: number; remainingSessions: number; expiredAt: string | null }>) => ({
  id: 1,
  serialNumber: 1,
  isPaid: true,
  finalPrice: 3200,
  remainingSessions: 5,
  expiredAt: null,
  card: { name: "10 堂卡" },
  ...over,
});

const student = ({
  cards = [],
  renewal = false,
  lastAttendDaysAgo = 3,
}: {
  cards?: ReturnType<typeof card>[];
  renewal?: boolean;
  lastAttendDaysAgo?: number | null;
}) =>
  ({
    studentCards: cards,
    tags: renewal ? [{ id: 1, name: "Needs Renewal" }] : [],
    overview: {
      lastAttendAt: lastAttendDaysAgo === null ? null : subDays(NOW, lastAttendDaysAgo).toISOString(),
    },
  }) as unknown as StudentWithDetail;

describe("attentionFor", () => {
  it("未付款最優先；只有一張時帶那張卡（可直接確認收款）", () => {
    const one = attentionFor(student({ cards: [card({ isPaid: false })], renewal: true }), NOW);
    expect(one).toMatchObject({ kind: "unpaid" });
    expect(one && one.kind === "unpaid" && one.card?.id).toBe(1);

    const two = attentionFor(
      student({ cards: [card({ isPaid: false }), card({ isPaid: false, remainingSessions: 0 })] }),
      NOW
    );
    expect(two).toMatchObject({ kind: "unpaid", card: null });
  });

  it("需續約：用完和快用完講法不同", () => {
    expect(attentionFor(student({ cards: [card({ remainingSessions: 0 })], renewal: true }), NOW)?.message).toContain("用完了");
    expect(attentionFor(student({ cards: [card({ remainingSessions: 2 })], renewal: true }), NOW)?.message).toContain("只剩 2 堂");
  });

  it("有卡但超過 30 天沒來；最近有來或沒卡就不提醒", () => {
    expect(attentionFor(student({ cards: [card({})], lastAttendDaysAgo: 45 }), NOW)).toMatchObject({ kind: "idle" });
    expect(attentionFor(student({ cards: [card({})], lastAttendDaysAgo: 10 }), NOW)).toBeNull();
    expect(attentionFor(student({ cards: [card({ remainingSessions: 0 })], lastAttendDaysAgo: 45 }), NOW)).toBeNull();
  });
});
