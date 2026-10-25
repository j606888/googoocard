import type { DanceLevels } from "@/domains/qualification";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { api } from "../api";
import { Card } from "./cards";
import { Classroom } from "./classrooms";

export interface StudentTag {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  number: number;
  name: string;
  note?: string;
  randomKey: string;
  avatarUrl: string;
  /** 封存時間；null = 在籍 */
  archivedAt: string | null;
  createdAt: string;
  classroom: Classroom;
  studentCards: StudentCardWithCard[];
  tags: StudentTag[];
  isInActiveLesson: boolean;
  activeLessonIds: number[];
  /** 有資格的舞種 id。 */
  danceQualifications: number[];
  /** 各舞種（以 danceStyleId 為 key）已完成階級（1=初階）；見 src/domains/qualification。 */
  danceLevels: DanceLevels;
  /** 最近一次出席那堂課的上課時間（不是點名時間）；從未上過課為 null。 */
  lastAttendAt: string | null;
  lastAttendLessonName: string | null;
  /** 有任何未付款的課卡（含已用完、已停用的）。只有名單 API 會帶。 */
  hasUnpaidCard?: boolean;
  /** 未付款課卡的金額合計。只有名單 API 會帶。 */
  unpaidAmount?: number;
  /** 沒買過任何非體驗課的卡（新同學）。只有名單 API 會帶。 */
  isNewStudent?: boolean;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  resourceType: string;
  resourceId: number;
}

export interface StudentWithDetail extends Student {
  /** The styles in `danceQualifications`, in the classroom's order — embedded so
   * LIFF and the public share page can label them without a teacher session. */
  qualifiedDanceStyles: DanceStyleSummary[];
  overview: {
    lastAttendAt: string | null;
    lastAttendLessonName: string | null;
    cardCount: number;
    /** 出席過的時段數（依上課日） */
    attendedCount: number;
    /** 本月／上月出席時段數，台北時區分月 */
    thisMonthCount: number;
    lastMonthCount: number;
    totalSpend: number;
    totalSaved: number;
  }
  attendancesByLesson: LessonAttendance[]
  attendancesByDate: {
    date: number;
    attendances: StudentAttendance[]
  }[]
}

/** 依課程：學生上過的一門課，連同該課的每個時段（出席與否）。 */
export interface LessonAttendance {
  lessonId: number;
  lessonName: string;
  danceStyle: DanceStyleSummary | null;
  level: number;
  status: "inProgress" | "finished";
  totalPeriods: number;
  lessonPeriodIds: number[];
  /** 依上課時間排序，舊的在前 */
  studentAttendances: {
    periodId: number;
    /** 第 N 堂 */
    periodNumber: number;
    periodStartTime: string;
    /** 老師已點名這個時段 */
    periodAttendantCheck: boolean;
    studentAttend: boolean;
    /** 扣的那張卡；沒出席或還沒綁卡是 null */
    studentCard: { id: number; serialNumber: number; name: string } | null;
    /** 學生自助簽到、老師還沒定案這個時段 */
    pending: boolean;
  }[];
}

/** 學生某一次出席（依上課日分組後的一筆）。 */
export interface StudentAttendance {
  lessonId: number;
  lessonName: string;
  periodNumber: number;
  totalPeriods: number;
  startTime: string;
  danceStyle: DanceStyleSummary | null;
  /** 扣的那張卡；null = 還沒綁卡 */
  studentCard: { id: number; serialNumber: number; name: string } | null;
  source: "TEACHER" | "STUDENT";
  /** 學生自助簽到、老師還沒定案這個時段 */
  pending: boolean;
}

export interface StudentCardWithCard extends StudentCard {
  card: Card;
  /** 這張卡扣過的時段，新的在前。 */
  attendanceRecords: {
    lessonName: string;
    periodStartTime: number;
    source: "TEACHER" | "STUDENT";
    /** 學生自助簽到、老師還沒定案這個時段 */
    pending: boolean;
  }[];
}

/** 轉換鏈另一端的卡 —— 只帶顯示「來自 #A0412」/「已轉換為 #A0873」需要的欄位。 */
export interface ConversionLinkCard {
  id: number;
  serialNumber: number;
  card: { name: string };
}

export type PaymentMethod = "CASH" | "TRANSFER";

export interface StudentCard {
  id: number;
  /** 教室內流水號；顯示用 formatCardSerial()（src/lib/cardSerial.ts） */
  serialNumber: number;
  studentId: number;
  cardId: number;
  basePrice: number;
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
  purchaseSource: "STAFF" | "STUDENT";
  note: string | null;
  origin: "PURCHASE" | "CONVERSION";
  convertedToId: number | null;
  /** 學生詳情（含公開頁／LIFF）才會帶，其他端點沒有 */
  convertedTo?: (ConversionLinkCard & { totalSessions: number }) | null;
  convertedFrom?: (ConversionLinkCard & { remainingSessions: number })[];
  isPaid: boolean;
  paidAt: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentReference?: string | null;
  purchasedBy?: { name: string } | null;
  /** 收款人：錢現在在誰手上 */
  paidBy?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  expiredAt: string | null;
}

export interface UnpaidStudentCard {
  id: number;
  serialNumber: number;
  studentId: number;
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
  createdAt: string;
  student: { id: number; name: string; avatarUrl: string };
  card: { name: string };
  purchasedBy?: { name: string } | null;
}

export interface LineInviteStudent {
  id: number;
  number: number;
  name: string;
  avatarUrl: string;
  lineInviteSentAt: string | null;
  lastAttendAt: string | null;
  /** 貼到 LINE 的邀請文字；教室沒設官方帳號 ID 時是 null */
  inviteMessage: string | null;
}

export interface LineInviteList {
  boundCount: number;
  totalCount: number;
  students: LineInviteStudent[];
}

const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<
      Student[],
      { query?: string; needsRenewal?: boolean; sort?: "name" | "number"; archived?: boolean } | void
    >({
      query: ({ query, needsRenewal, sort, archived } = {}) => {
        const searchParams = new URLSearchParams();
        if (archived) {
          searchParams.set("archived", "1");
        }
        if (query) {
          searchParams.set("query", query);
        }
        if (needsRenewal) {
          searchParams.set("needsRenewal", "true");
        }
        if (sort) {
          searchParams.set("sort", sort);
        }
        const queryString = searchParams.toString();
        return `students${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: ["Student"],
    }),
    getPublicStudent: builder.query<StudentWithDetail, { randomKey: string }>({
      query: ({ randomKey }) => `public-students/${randomKey}`,
      providesTags: ["Student"],
    }),
    getStudentLineBindLink: builder.query<
      { bound: boolean; key?: string; deepLink?: string | null },
      { id: number }
    >({
      query: ({ id }) => `students/${id}/line-bind-link`,
      providesTags: ["Student"],
    }),
    getLineInvites: builder.query<LineInviteList, void>({
      query: () => "students/line-invites",
      providesTags: ["Student"],
    }),
    markLineInviteSent: builder.mutation<{ id: number; lineInviteSentAt: string }, { id: number }>({
      query: ({ id }) => ({ url: `students/${id}/line-invite`, method: "POST" }),
      invalidatesTags: ["Student"],
    }),
    createStudent: builder.mutation<
      Student,
      { name: string; avatarUrl: string; note?: string }
    >({
      query: ({ name, avatarUrl, note }) => ({
        url: "students",
        method: "POST",
        body: { name, avatarUrl, note },
      }),
      invalidatesTags: ["Student"],
    }),
    updateStudent: builder.mutation<Student, { id: number; name: string; note?: string; avatarUrl: string; danceLevels: DanceLevels }>({
      query: ({ id, name, note, avatarUrl, danceLevels }) => ({
        url: `students/${id}`,
        method: "PATCH",
        body: { name, note, avatarUrl, danceLevels },
      }),
      invalidatesTags: ["Student"],
    }),
    /** 只改舞種資格（詳情側欄點一下就存），不碰姓名、備註、頭像。 */
    updateStudentDanceLevels: builder.mutation<Student, { id: number; danceLevels: DanceLevels }>({
      query: ({ id, danceLevels }) => ({
        url: `students/${id}`,
        method: "PATCH",
        body: { danceLevels },
      }),
      invalidatesTags: ["Student"],
    }),
    /** 封存／還原學生（不刪資料）。學生沒有 DELETE。 */
    setStudentArchived: builder.mutation<Student, { id: number; archived: boolean }>({
      query: ({ id, archived }) => ({
        url: `students/${id}`,
        method: "PATCH",
        body: { archived },
      }),
      invalidatesTags: ["Student"],
    }),
    getStudentCards: builder.query<StudentCard[], { id: number }>({
      query: ({ id }) => `students/${id}/student-cards`,
      providesTags: ["StudentCard"],
    }),
    createStudentCard: builder.mutation<StudentCard, { id: number; cardId: number; sessions: number; price: number; lessonId?: number; isPaid?: boolean; note?: string }>({
      query: ({ id, cardId, sessions, price, lessonId, isPaid, note }) => ({
        url: `students/${id}/student-cards`,
        method: "POST",
        body: { cardId, sessions, price, lessonId, isPaid, note },
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    confirmStudentCardPayment: builder.mutation<
      StudentCard,
      {
        id: number;
        studentCardId: number;
        paymentMethod?: PaymentMethod;
        paymentReference?: string | null;
        receiverUserId?: number;
      }
    >({
      query: ({ id, studentCardId, ...body }) => ({
        url: `students/${id}/student-cards/${studentCardId}/confirm-payment`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    getUnpaidStudentCards: builder.query<UnpaidStudentCard[], void>({
      query: () => "student-cards/unpaid",
      providesTags: ["StudentCard"],
    }),
    expireStudentCard: builder.mutation<StudentCard, { id: number; studentCardId: number }>({
      query: ({ id, studentCardId }) => ({
        url: `students/${id}/student-cards/${studentCardId}/expire`,
        method: "POST",
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    updateStudentCardNote: builder.mutation<StudentCard, { id: number; studentCardId: number; note: string | null }>({
      query: ({ id, studentCardId, note }) => ({
        url: `students/${id}/student-cards/${studentCardId}`,
        method: "PATCH",
        body: { note },
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    convertStudentCard: builder.mutation<
      StudentCard,
      { id: number; studentCardId: number; targetCardId: number; sessions?: number; note?: string }
    >({
      query: ({ id, studentCardId, targetCardId, sessions, note }) => ({
        url: `students/${id}/student-cards/${studentCardId}/convert`,
        method: "POST",
        body: { targetCardId, sessions, note },
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    deleteStudentCard: builder.mutation<{ success: boolean }, { id: number; studentCardId: number }>({
      query: ({ id, studentCardId }) => ({
        url: `students/${id}/student-cards/${studentCardId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    getStudent: builder.query<StudentWithDetail, { id: number }>({
      query: ({ id }) => `students/${id}`,
      providesTags: ["Student"],
    }),
    getStudentCardsByLesson: builder.query<StudentCardWithCard[], { studentId: number; lessonId: number }>({
      query: ({ studentId, lessonId }) => `lessons/${lessonId}/students/${studentId}/student-cards`,
      providesTags: ["StudentCard"],
    }),
    getStudentEvents: builder.query<Event[], { id: number }>({
      query: ({ id }) => `students/${id}/events`,
      providesTags: ["Student"],
    }),
    getTags: builder.query<StudentTag[], void>({
      query: () => "tags",
      providesTags: ["Tag"],
    }),
    addStudentTag: builder.mutation<{ id: number; studentId: number; tagId: number; tag: StudentTag }, { studentId: number; tagName: string }>({
      query: ({ studentId, tagName }) => ({
        url: `students/${studentId}/tags`,
        method: "POST",
        body: { tagName },
      }),
      invalidatesTags: ["Student", "Tag"],
    }),
    removeStudentTag: builder.mutation<{ success: boolean }, { studentId: number; tagId: number }>({
      query: ({ studentId, tagId }) => ({
        url: `students/${studentId}/tags/${tagId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Student"],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetPublicStudentQuery,
  useGetStudentLineBindLinkQuery,
  useGetLineInvitesQuery,
  useMarkLineInviteSentMutation,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useSetStudentArchivedMutation,
  useUpdateStudentDanceLevelsMutation,
  useGetStudentCardsQuery,
  useCreateStudentCardMutation,
  useConfirmStudentCardPaymentMutation,
  useGetUnpaidStudentCardsQuery,
  useGetStudentQuery,
  useExpireStudentCardMutation,
  useUpdateStudentCardNoteMutation,
  useConvertStudentCardMutation,
  useDeleteStudentCardMutation,
  useGetStudentCardsByLessonQuery,
  useGetStudentEventsQuery,
  useGetTagsQuery,
  useAddStudentTagMutation,
  useRemoveStudentTagMutation,
} = studentsApi;
