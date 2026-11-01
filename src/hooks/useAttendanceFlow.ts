"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useGetAttendanceQuery, useGetLessonQuery } from "@/store/slices/lessons";
import {
  attendanceRowTag,
  filterByKeyword,
  findPeriod,
  lessonCardStatus,
  lessonStudentIds,
  selectStudents,
  splitByRoster,
  type RowTag,
} from "./attendanceFlow";

/**
 * 點名畫面的資料與選取狀態。外殼只負責排版與轉發事件。
 *
 * 放在 `src/hooks/` 而不是 PeriodAttendanceForm 底下：Wave 3 的桌面點名
 * 會是另一個外殼（同一份流程、不同呈現），到時要 import 同一顆 hook，
 * 擺在單一外殼的資料夾裡會變成跨資料夾相依。純推導在 `attendanceFlow.ts`。
 */
export const useAttendanceFlow = ({
  lessonId,
  periodId,
  defaultSelectedIds = [],
}: {
  lessonId: string;
  periodId: number;
  defaultSelectedIds?: number[];
}) => {
  const { data: students, isLoading: isStudentsLoading } = useGetStudentsQuery();
  const { data: lesson, isLoading: isLessonLoading } = useGetLessonQuery(lessonId);
  // 外殼（CheckPeriod / EditPeriod）也抓同一份，RTK Query 會共用快取、不會多打一次。
  const { data: records } = useGetAttendanceQuery({ id: Number(lessonId), periodId });

  const [selectedIds, setSelectedIds] = useState<number[]>(defaultSelectedIds);
  const [keyword, setKeyword] = useState("");

  // 老師後台點名載入時會帶出已存在的紀錄（含自助簽到），用它預設勾選。
  // 只在「有東西可帶」時覆寫，避免把使用者取消勾選的結果又蓋回去。
  useEffect(() => {
    if (defaultSelectedIds.length > 0) setSelectedIds(defaultSelectedIds);
  }, [defaultSelectedIds]);

  const period = findPeriod(lesson, periodId);
  const attendStudentIds = useMemo(() => lessonStudentIds(lesson), [lesson]);
  const selectedStudents = useMemo(
    () => selectStudents(students, selectedIds),
    [students, selectedIds]
  );
  const filteredStudents = useMemo(
    () => filterByKeyword(students, keyword),
    [students, keyword]
  );

  const { roster: rosterStudents, others: otherStudents } = useMemo(
    () => splitByRoster(filteredStudents, attendStudentIds),
    [filteredStudents, attendStudentIds]
  );
  /** 名冊全員（不受搜尋影響）——審核抽屜要列出「還沒勾」的人。 */
  const allRosterStudents = useMemo(
    () => splitByRoster(students ?? [], attendStudentIds).roster,
    [students, attendStudentIds]
  );

  // 每列尾端的狀態標籤（最多一個）。這個時段已經扣到卡的（自助簽到當下扣的）
  // 今天已經付掉，不再標沒卡／剩幾堂。
  const rowTags = useMemo(() => {
    const covered = new Set(
      (records ?? []).filter((record) => record.cardId).map((record) => record.studentId)
    );
    const tags = new Map<number, RowTag>();
    for (const student of students ?? []) {
      const tag = attendanceRowTag({
        cardStatus: lesson ? lessonCardStatus(student, lesson) : undefined,
        unpaidAmount: student.unpaidAmount,
        cardCovered: covered.has(student.id),
      });
      if (tag) tags.set(student.id, tag);
    }
    return tags;
  }, [students, lesson, records]);

  const addStudent = (studentId: number) =>
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev : [...prev, studentId]
    );

  const removeStudent = (studentId: number) =>
    setSelectedIds((prev) => prev.filter((id) => id !== studentId));

  const toggleStudent = (studentId: number) =>
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );

  /** 一次勾／取消一批（「全選」「全不選」）。 */
  const setMany = (studentIds: number[], checked: boolean) =>
    setSelectedIds((prev) => {
      const ids = new Set(studentIds);
      const rest = prev.filter((id) => !ids.has(id));
      return checked ? [...rest, ...studentIds] : rest;
    });

  return {
    /** 這次要點名的時段；undefined 代表 lesson 還沒載入或時段不屬於這堂課。 */
    period,
    /** 名單或課程還在第一次載入——外殼用來顯示骨架，免得名單先空白再跳出來。 */
    isLoading: isStudentsLoading || isLessonLoading,
    /** 已在課程名冊上的學生 id。 */
    attendStudentIds,
    /** 目前勾選的學生（維持 students 的原始順序）。 */
    selectedStudents,
    selectedIds,
    /** 依搜尋關鍵字過濾後的完整名單。 */
    filteredStudents,
    /** 過濾後、在這門課名冊上的學生。 */
    rosterStudents,
    /** 過濾後、不在名冊上的學生。 */
    otherStudents,
    allRosterStudents,
    /** 學生 id → 列尾狀態標籤；沒問題的學生不在裡面。 */
    rowTags,
    lesson,
    keyword,
    search: setKeyword,
    addStudent,
    removeStudent,
    toggleStudent,
    setMany,
    setSelectedIds,
  };
};
