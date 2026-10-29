import { api } from "../api";

export interface TodoStudent {
  id: number;
  name: string;
  avatarUrl: string;
}

export interface Todos {
  unpaidCards: {
    id: number;
    serialNumber: number;
    cardName: string;
    finalPrice: number;
    purchaseSource: "STAFF" | "STUDENT";
    usedSessions: number;
    totalSessions: number;
    createdAt: string;
    student: TodoStudent;
  }[];
  /** 付單堂但還沒收到錢 */
  unpaidDropIns: {
    id: number;
    amount: number;
    createdAt: string;
    student: TodoStudent;
    lessonId: number;
    lessonName: string;
    lessonPeriodId: number;
    lessonPeriodStartTime: string;
  }[];
  /** 需續約、且近 30 天有來上課的人（更久沒來的只在 inactiveRenewalCount） */
  needsRenewal: {
    student: TodoStudent;
    since: string;
    lastAttendedAt: string;
    lineBound: boolean;
    /** 這次用完之後 LINE 續卡提醒發出的時間；沒發過是 null */
    lastRemindedAt: string | null;
  }[];
  inactiveRenewalCount: number;
  unboundAttendance: {
    id: number;
    source: "TEACHER" | "STUDENT";
    student: TodoStudent;
    lessonId: number;
    lessonName: string;
    lessonPeriodId: number;
    lessonPeriodStartTime: string;
  }[];
  /** 14 天內上過體驗課、還沒買正式卡 */
  trialFollowUps: {
    student: TodoStudent;
    lessonId: number;
    lessonName: string;
    trialAt: string;
  }[];
  /** 同名的在籍學生組（多半是自助登記的新同學 ↔ 沒綁 LINE 的舊生） */
  possibleDuplicates: {
    name: string;
    students: (TodoStudent & { lineBound: boolean; createdAt: string })[];
  }[];
  /** 要處理（未付款課卡 + 未付單堂 + 出席沒綁課卡）：紅色數字、圖示 badge */
  urgentCount: number;
  /** 提醒（需續約 + 體驗後沒買卡 + 可能重複）：只顯示灰點 */
  reminderCount: number;
  /** 同 urgentCount（App 舊版拿它設圖示數字） */
  total: number;
}

const todosApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // 「待處理」由收款、續卡、點名綁卡等狀態推導而來，任一邊變動都要重抓。
    // 學生在 LIFF 自助買卡／簽到不會觸發本頁的 mutation，所以另外靠 refetchOnFocus。
    getTodos: builder.query<Todos, void>({
      query: () => "todos",
      providesTags: ["Lesson", "Student", "StudentCard", "AttendanceRecord", "Tag"],
    }),
  }),
});

export const { useGetTodosQuery } = todosApi;
