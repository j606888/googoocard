import { describe, it, expect } from "vitest";
import type { Student } from "@/store/slices/students";
import type { Lesson, Period } from "@/store/slices/lessons";
import {
  lessonStudentIds,
  findPeriod,
  selectStudents,
  filterByKeyword,
  splitByRoster,
  lessonCardStatus,
  attendanceRowTag,
} from "./attendanceFlow";
import type { CardStatus } from "@/domains/attendance/rosterInsights";

const student = (id: number, name: string) => ({ id, name }) as Student;

const period = (id: number) => ({ id }) as Period;

describe("lessonStudentIds", () => {
  it("回傳課程名冊上的學生 id", () => {
    const lesson = { students: [student(1, "小明"), student(2, "小華")] };
    expect(lessonStudentIds(lesson as Lesson)).toEqual([1, 2]);
  });

  it("lesson 還沒載入時回空陣列", () => {
    expect(lessonStudentIds(undefined)).toEqual([]);
  });
});

describe("findPeriod", () => {
  const lesson = { periods: [period(10), period(11)] } as Lesson;

  it("找得到指定時段", () => {
    expect(findPeriod(lesson, 11)).toEqual(period(11));
  });

  it("時段不屬於這堂課時回 undefined", () => {
    expect(findPeriod(lesson, 99)).toBeUndefined();
  });

  it("lesson 還沒載入時回 undefined", () => {
    expect(findPeriod(undefined, 10)).toBeUndefined();
  });
});

describe("selectStudents", () => {
  const students = [student(1, "小明"), student(2, "小華"), student(3, "小美")];

  it("依 id 取出被勾選的學生", () => {
    expect(selectStudents(students, [3, 1]).map((s) => s.name)).toEqual([
      "小明",
      "小美",
    ]);
  });

  it("維持 students 的原始順序，不跟著勾選順序跑", () => {
    expect(selectStudents(students, [3, 2, 1]).map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("id 不存在時安靜略過", () => {
    expect(selectStudents(students, [1, 999]).map((s) => s.id)).toEqual([1]);
  });

  it("students 還沒載入時回空陣列", () => {
    expect(selectStudents(undefined, [1])).toEqual([]);
  });
});

describe("filterByKeyword", () => {
  const students = [student(1, "Amy"), student(2, "amanda"), student(3, "小華")];

  it("空關鍵字不過濾", () => {
    expect(filterByKeyword(students, "")).toHaveLength(3);
  });

  it("只有空白的關鍵字也不過濾", () => {
    expect(filterByKeyword(students, "   ")).toHaveLength(3);
  });

  it("大小寫不敏感的子字串比對", () => {
    expect(filterByKeyword(students, "AM").map((s) => s.id)).toEqual([1, 2]);
  });

  it("關鍵字前後空白不影響比對", () => {
    expect(filterByKeyword(students, "  小  ").map((s) => s.id)).toEqual([3]);
  });

  it("沒有符合的回空陣列", () => {
    expect(filterByKeyword(students, "zzz")).toEqual([]);
  });
});

describe("splitByRoster", () => {
  it("依名冊拆成兩組，各自維持原本順序", () => {
    const students = [student(3, "C"), student(1, "A"), student(2, "B")];
    expect(splitByRoster(students, [2, 3])).toEqual({
      roster: [student(3, "C"), student(2, "B")],
      others: [student(1, "A")],
    });
  });
});

describe("lessonCardStatus", () => {
  const lesson = {
    cards: [{ id: 10 }, { id: 11 }],
    danceStyleId: 5,
    level: 2,
    danceStyle: { hasLevels: true },
  } as unknown as Lesson;
  const sc = (cardId: number, remainingSessions: number, card: { isPracticeCard: boolean; danceStyleId: number | null }) =>
    ({ cardId, remainingSessions, card });

  it("只算這堂課掛的卡", () => {
    const status = lessonCardStatus(
      {
        studentCards: [
          sc(10, 3, { isPracticeCard: false, danceStyleId: null }),
          sc(99, 8, { isPracticeCard: false, danceStyleId: null }),
        ],
        danceLevels: {},
      } as unknown as Student,
      lesson
    );
    expect(status.usableSessions).toBe(3);
    expect(status.level).toBe("ok");
  });

  it("複習卡資格不夠時算 blocked", () => {
    const status = lessonCardStatus(
      {
        studentCards: [sc(11, 4, { isPracticeCard: true, danceStyleId: 5 })],
        danceLevels: { 5: 1 },
      } as unknown as Student,
      lesson
    );
    expect(status).toMatchObject({ level: "none", blockedCardCount: 1, usableCardCount: 0 });
  });

  it("沒有卡的學生是 none", () => {
    expect(
      lessonCardStatus({ studentCards: [], danceLevels: {} } as unknown as Student, lesson).level
    ).toBe("none");
  });
});

describe("attendanceRowTag", () => {
  const status = (over: Partial<CardStatus>): CardStatus => ({
    usableSessions: 5,
    usableCardCount: 1,
    blockedCardCount: 0,
    otherSessions: 0,
    level: "ok",
    ...over,
  });
  const none = status({ usableSessions: 0, usableCardCount: 0, level: "none" });

  it("卡況正常、沒欠錢：不顯示", () => {
    expect(attendanceRowTag({ cardStatus: status({}) })).toBeNull();
  });

  it("沒卡優先於未付", () => {
    expect(attendanceRowTag({ cardStatus: none, unpaidAmount: 3200 })).toEqual({
      tone: "warning",
      label: "沒卡",
    });
  });

  it("只有不能用的複習卡：資格不符", () => {
    expect(
      attendanceRowTag({ cardStatus: status({ ...none, blockedCardCount: 1 }) })
    ).toEqual({ tone: "warning", label: "資格不符" });
  });

  it("未付優先於剩 1 堂", () => {
    expect(
      attendanceRowTag({
        cardStatus: status({ usableSessions: 1, level: "low" }),
        unpaidAmount: 3200,
      })
    ).toEqual({ tone: "danger", label: "未付 $3,200" });
  });

  it("剩 1 堂", () => {
    expect(
      attendanceRowTag({ cardStatus: status({ usableSessions: 1, level: "low" }) })
    ).toEqual({ tone: "warning", label: "剩 1 堂" });
  });

  it("這個時段已扣到卡：不標沒卡／剩幾堂，但仍標未付", () => {
    expect(attendanceRowTag({ cardStatus: none, cardCovered: true })).toBeNull();
    expect(
      attendanceRowTag({ cardStatus: none, cardCovered: true, unpaidAmount: 500 })
    ).toEqual({ tone: "danger", label: "未付 $500" });
  });

  it("不知道卡況時只看未付", () => {
    expect(attendanceRowTag({})).toBeNull();
  });
});
