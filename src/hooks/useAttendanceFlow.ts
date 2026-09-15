"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useGetLessonQuery } from "@/store/slices/lessons";
import {
  filterByKeyword,
  findPeriod,
  lessonStudentIds,
  selectStudents,
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
  const { data: students } = useGetStudentsQuery();
  const { data: lesson } = useGetLessonQuery(lessonId);

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

  const addStudent = (studentId: number) =>
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev : [...prev, studentId]
    );

  const removeStudent = (studentId: number) =>
    setSelectedIds((prev) => prev.filter((id) => id !== studentId));

  return {
    /** 這次要點名的時段；undefined 代表 lesson 還沒載入或時段不屬於這堂課。 */
    period,
    /** 已在課程名冊上的學生 id。 */
    attendStudentIds,
    /** 目前勾選的學生（維持 students 的原始順序）。 */
    selectedStudents,
    selectedIds,
    /** 依搜尋關鍵字過濾後的完整名單。 */
    filteredStudents,
    keyword,
    search: setKeyword,
    addStudent,
    removeStudent,
    setSelectedIds,
  };
};
