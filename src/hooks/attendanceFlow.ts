import type { Student } from "@/store/slices/students";
import type { Lesson, Period } from "@/store/slices/lessons";

/**
 * 點名流程的純推導。全部是純函式，和 React 無關——
 * 手機整頁流程與（Wave 3 之後的）桌面面板共用同一份規則，
 * 抽出來是為了兩個外殼不會各自長出一份略有出入的過濾邏輯。
 *
 * 有狀態的部分在 `useAttendanceFlow.ts`。
 */

/** 這堂課已經有名冊的學生 id。用來在名單上標「已在課程中」。 */
export const lessonStudentIds = (lesson?: Pick<Lesson, "students">): number[] =>
  lesson?.students.map((student) => student.id) ?? [];

/** 從 lesson 取出這次要點名的時段；找不到回 undefined（呼叫端顯示載入中）。 */
export const findPeriod = (
  lesson: Pick<Lesson, "periods"> | undefined,
  periodId: number
): Period | undefined =>
  lesson?.periods.find((period) => period.id === periodId);

/**
 * 依 id 取出被勾選的學生，**維持 students 的原始順序**
 * （而不是勾選順序）——已選清單才不會在勾選時跳動。
 */
export const selectStudents = (
  students: Student[] | undefined,
  selectedIds: number[]
): Student[] => {
  const ids = new Set(selectedIds);
  return students?.filter((student) => ids.has(student.id)) ?? [];
};

/** 姓名關鍵字過濾，大小寫不敏感；空字串或全空白代表不過濾。 */
export const filterByKeyword = (
  students: Student[] | undefined,
  keyword: string
): Student[] => {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return students ?? [];
  return (
    students?.filter((student) =>
      student.name.toLowerCase().includes(needle)
    ) ?? []
  );
};
