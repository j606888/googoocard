import type { Student } from "@/store/slices/students";
import type { Lesson, Period } from "@/store/slices/lessons";
import { cardStatusFor, type CardStatus } from "@/domains/attendance/rosterInsights";
import { formatMoney } from "@/lib/money";

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

/** 名單拆成「這門課的學生」與「其他學生」，各自維持原本順序。 */
export const splitByRoster = <T extends { id: number }>(
  students: T[],
  rosterIds: number[]
): { roster: T[]; others: T[] } => {
  const ids = new Set(rosterIds);
  return {
    roster: students.filter((student) => ids.has(student.id)),
    others: students.filter((student) => !ids.has(student.id)),
  };
};

/**
 * 學生在**這堂課**還能扣多少——跟課程頁名冊（`/api/lessons/[id]/students`）
 * 同一條規則：只算這堂課掛的卡、還有堂數、沒停用的（名單 API 的
 * `studentCards` 已經只帶未停用、有堂數的卡），再交給 `cardStatusFor` 判斷資格。
 * 名冊外的學生也能算，不必多打一支 API。
 */
export const lessonCardStatus = (
  student: Pick<Student, "studentCards" | "danceLevels">,
  lesson: Pick<Lesson, "cards" | "danceStyleId" | "level" | "danceStyle">
): CardStatus => {
  const lessonCardIds = new Set(lesson.cards.map((card) => card.id));
  const cards = (student.studentCards ?? []).filter(
    (studentCard) =>
      lessonCardIds.has(studentCard.cardId) && studentCard.remainingSessions > 0
  );
  return cardStatusFor(cards, student.danceLevels ?? {}, lesson);
};

export type RowTag = { tone: "warning" | "danger"; label: string };

/**
 * 點名列尾端的狀態標籤：最多一個，只在有問題時出現。
 * 優先序：沒卡／資格不符 → 未付 $X → 剩 1 堂。卡況正常的學生什麼都不顯示。
 *
 * `cardCovered`：這個時段已經有紀錄、而且扣到卡了（例如自助簽到時扣的）——
 * 今天這堂已經付掉，剩幾堂不是這一刻的問題，不標沒卡／剩 1 堂。
 */
export const attendanceRowTag = ({
  cardStatus,
  unpaidAmount = 0,
  cardCovered = false,
}: {
  cardStatus?: CardStatus;
  unpaidAmount?: number;
  cardCovered?: boolean;
}): RowTag | null => {
  if (cardStatus && !cardCovered && cardStatus.level === "none") {
    return {
      tone: "warning",
      label:
        cardStatus.blockedCardCount > 0 && cardStatus.usableCardCount === 0
          ? "資格不符"
          : "沒卡",
    };
  }
  if (unpaidAmount > 0) {
    return { tone: "danger", label: `未付 $${formatMoney(unpaidAmount)}` };
  }
  if (cardStatus && !cardCovered && cardStatus.level === "low") {
    return { tone: "warning", label: `剩 ${cardStatus.usableSessions} 堂` };
  }
  return null;
};
