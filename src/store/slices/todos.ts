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
    createdAt: string;
    student: TodoStudent;
  }[];
  needsRenewal: { student: TodoStudent; since: string }[];
  unboundAttendance: {
    id: number;
    source: "TEACHER" | "STUDENT";
    student: TodoStudent;
    lessonId: number;
    lessonName: string;
    lessonPeriodId: number;
    lessonPeriodStartTime: string;
  }[];
  total: number;
}

const todosApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // 「待處理」由收款、續卡、點名綁卡三種狀態推導而來，任一邊變動都要重抓。
    // 學生在 LIFF 自助買卡／簽到不會觸發本頁的 mutation，所以另外靠 refetchOnFocus。
    getTodos: builder.query<Todos, void>({
      query: () => "todos",
      providesTags: ["Lesson", "Student", "StudentCard", "AttendanceRecord", "Tag"],
    }),
  }),
});

export const { useGetTodosQuery } = todosApi;
