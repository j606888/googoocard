import { describe, it, expect } from "vitest";
import type { Student } from "@/store/slices/students";
import type { Lesson, Period } from "@/store/slices/lessons";
import {
  lessonStudentIds,
  findPeriod,
  selectStudents,
  filterByKeyword,
} from "./attendanceFlow";

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
