import { Student } from "./students";
import { api } from "../api";
import { Card } from "./cards";
import type { TeacherSummary } from "./teachers";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { LocationSummary } from "@/lib/locations";
import type { CardStatus } from "@/domains/attendance/rosterInsights";
import type { DanceLevels } from "@/domains/qualification";
import type { LessonKind } from "@/lib/lessonKind";

export interface Lesson {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  students: Student[];
  periods: Period[];
  teachers: TeacherSummary[];
  danceStyleId: number;
  danceStyle: DanceStyleSummary;
  /** 1 = 初階, 2 = 中階, 3 = 進階 — see src/lib/danceLevels.ts. */
  level: number;
  status: string;
  /** "fixed" | "ongoing" — see src/lib/lessonKind.ts. */
  kind: LessonKind;
  /** Set when ended by hand; finished regardless of kind. */
  endedAt: string | null;
  cards: Card[];
  groupId: number | null;
  group: { id: number; name: string } | null;
  /** 分部 — null when not set. */
  locationId: number | null;
  location: LocationSummary | null;
}

export interface Period {
  id: number;
  lessonId: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
}

/** Lightweight per-lesson shape returned by the list endpoint (GET /lessons). */
export interface LessonSummary {
  id: number;
  name: string;
  danceStyleId: number;
  danceStyle: DanceStyleSummary;
  level: number;
  status: string;
  kind: LessonKind;
  endedAt: string | null;
  studentCount: number;
  teachers: TeacherSummary[];
  cardIds: number[];
  groupId: number | null;
  location: LocationSummary | null;
  totalPeriods: number;
  attendedCount: number;
  /** Earliest upcoming session start (ISO), or null — informational "next class". */
  nextSessionDate: string | null;
  nextSessionEndTime: string | null;
  nextSessionPeriodId: number | null;
  /** Periods already due but not yet checked — drives the 點名 CTA / warning. */
  dueForAttendanceCount: number;
  dueForAttendancePeriodId: number | null;
  dueForAttendanceDate: string | null;
  dueForAttendanceEndTime: string | null;
  /** CTA target is an older unchecked period, not today's — show its date, not just its time. */
  dueForAttendanceIsBacklog: boolean;
  /** Start of the earliest period — with lastPeriodEnd, the lesson's 期間. */
  firstPeriodStart: string | null;
  lastPeriodStart: string | null;
  lastPeriodEnd: string | null;
}

/** One period of GET /lessons/agenda — the lessons list's 下一堂／上課中／還沒點名. */
export interface AgendaPeriod {
  id: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
  /** 1-based position among the lesson's periods (第 N 堂). */
  number: number;
  /** Students with a record for this period — self check-ins included. */
  attendeeIds: number[];
  lesson: {
    id: number;
    name: string;
    kind: LessonKind;
    danceStyle: DanceStyleSummary;
    teachers: TeacherSummary[];
    studentCount: number;
    totalPeriods: number;
  };
}

/** One session (LessonPeriod) as returned by GET /lessons/calendar. */
export interface CalendarPeriod {
  periodId: number;
  lessonId: number;
  lessonName: string;
  danceStyleId: number | null;
  danceStyle: DanceStyleSummary | null;
  lessonStatus: string;
  startTime: string;
  endTime: string;
  attendanceTaken: boolean;
  attendeeCount: number;
  teacherNames: string[];
  location: LocationSummary | null;
}

export interface GetLessonsArgs {
  tab: string;
  sort: string;
  search?: string;
  danceStyleId?: number | null;
  /** Restrict to one LessonGroup's members — omit for the unfiltered list. */
  groupId?: number | null;
  /** Restrict to one 分部. */
  locationId?: number | null;
  page?: number;
}

export interface Answer {
  studentId: number;
  createNewCard: boolean;
  selectedCardId: number | null;
  cardSessions: string;
  cardPrice: string;
}

export interface DraftLesson {
  lessonName: string;
  teacherIds: number[];
  cardIds: number[];
  danceStyleId: number;
  /** 1 = 初階 (default), 2 = 中階, 3 = 進階. */
  level?: number;
  /** Omitted on create = "fixed"; omitted on update = unchanged. */
  kind?: LessonKind;
  /** LessonGroup to file this lesson under — null means 未分類 (ungrouped). */
  groupId?: number | null;
  /** 分部 — null/omitted = not set (PUT clears it when omitted). */
  locationId?: number | null;
  periods?: {
    startTime: string;
    endTime: string;
  }[];
}

export interface AttendanceRecord {
  studentId: number;
  studentName: string;
  studentAvatarUrl: string;
  cardId: number;
  cardName: string;
  remainingSessions: number;
  income: number;
  uncheckedType:
    | "no_card"
    | "no_practice_card"
    | "multiple_cards"
    | "not_checked"
    | "not_qualified";
  recommendedStudentCardId?: number | null;
  reason?: "PRACTICE_PRIORITY" | null;
  source?: "TEACHER" | "STUDENT";
}

export interface UnbindAttendanceRecord {
  id: number;
  studentId: number;
  studentName: string;
  studentAvatarUrl: string;
  lessonName: string;
  lessonId: number;
  lessonPeriodId: number;
  lessonPeriodStartTime: string;
}

export interface LessonStudent {
  id: number;
  name: string;
  avatarUrl: string;
  attendances: {
    /** Join key: two periods can share a startTime, so never match on that. */
    periodId: number;
    startTime: string;
    attendanceStatus: "not_started" | "attended" | "absent";
  }[];
  /**
   * What this student can still spend **on this lesson** — not the same as the
   * classroom-wide "Needs Renewal" tag. See src/domains/attendance/rosterInsights.ts.
   */
  cardStatus: CardStatus;
  /** Ids of the dance styles the student is qualified for. */
  danceQualifications: number[];
  danceLevels: DanceLevels;
}

/** 課程頁的體驗名單（GET /api/lessons/[id]/trials）。 */
export interface TrialEntry {
  studentCardId: number;
  serialNumber: number;
  /** registered = 已登記、還沒上；attended = 這張體驗卡已用在這堂課。 */
  status: "registered" | "attended";
  student: { id: number; name: string; avatarUrl: string };
  cardName: string;
  finalPrice: number;
  isPaid: boolean;
  paymentMethod: "CASH" | "TRANSFER" | null;
  registeredAt: string;
  attendedAt: string | null;
}

export interface TrialRoster {
  trialCards: { id: number; name: string; price: number }[];
  entries: TrialEntry[];
}

export interface RegisterTrialBody {
  studentId?: number;
  newStudentName?: string;
  cardId: number;
  finalPrice?: number;
  isPaid: boolean;
  paymentMethod?: "CASH" | "TRANSFER" | null;
  paymentReference?: string | null;
}

const lessonsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLessons: builder.query<
      {
        lessons: LessonSummary[];
        tabsCount: { inProgress: number; finished: number };
        hasNextPage: boolean;
        availableDanceStyleIds: number[];
        availableLocationIds: number[];
      },
      GetLessonsArgs
    >({
      query: ({ tab, sort, search, danceStyleId, groupId, locationId, page }) => {
        const params = new URLSearchParams({ tab, sort });
        if (search) params.set("search", search);
        if (danceStyleId) params.set("danceStyleId", String(danceStyleId));
        if (locationId) params.set("locationId", String(locationId));
        // undefined = no group filter; null = the virtual 未分類 bucket; a
        // number = that one LessonGroup's members.
        if (groupId !== undefined) params.set("groupId", groupId === null ? "none" : String(groupId));
        if (page !== undefined) params.set("page", String(page));
        return `lessons?${params.toString()}`;
      },
      providesTags: ["Lesson"],
    }),
    getLesson: builder.query<Lesson, string | number>({
      query: (id) => `lessons/${id}`,
      providesTags: ["Lesson"],
    }),
    getLessonAgenda: builder.query<{ periods: AgendaPeriod[] }, void>({
      query: () => "lessons/agenda",
      providesTags: ["Lesson", "Attendance", "AttendanceRecord"],
    }),
    getCalendarPeriods: builder.query<
      CalendarPeriod[],
      { from: string; to: string }
    >({
      query: ({ from, to }) => `lessons/calendar?from=${from}&to=${to}`,
      providesTags: ["Lesson"],
    }),
    createLesson: builder.mutation<void, DraftLesson>({
      query: (draftLesson) => ({
        url: "lessons",
        method: "POST",
        body: draftLesson,
      }),
      invalidatesTags: ["Lesson"],
    }),
    updateLesson: builder.mutation<void, { id: number; draftLesson: DraftLesson }>({
      query: ({ id, draftLesson }) => ({
        url: `lessons/${id}`,
        method: "PUT",
        body: draftLesson,
      }),
      invalidatesTags: ["Lesson"],
    }),
    checkStudentCards: builder.query<
      { invalidStudentIds: number[] },
      { id: number; studentIds: number[] }
    >({
      query: ({ id, studentIds }) => ({
        url: `lessons/${id}/check-student-cards`,
        method: "POST",
        body: { studentIds },
      }),
      providesTags: ["StudentCard"],
    }),
    takeAttendance: builder.mutation<
      void,
      { id: number; periodId: number; studentIds: number[] }
    >({
      query: ({ id, periodId, studentIds }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance`,
        method: "POST",
        body: { studentIds },
      }),
      invalidatesTags: ["Lesson", "Student", "StudentCard", "Card", "AttendanceRecord"],
    }),
    updateAttendance: builder.mutation<
      void,
      { id: number; periodId: number; studentIds: number[] }
    >({
      query: ({ id, periodId, studentIds }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance`,
        method: "PUT",
        body: { studentIds },
      }),
      invalidatesTags: ["Lesson", "Student", "StudentCard", "Card", "AttendanceRecord"],
    }),
    getAttendance: builder.query<
      AttendanceRecord[],
      { id: number; periodId: number }
    >({
      query: ({ id, periodId }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance`,
        method: "GET",
      }),
      providesTags: ["Lesson", "Attendance"],
    }),
    resetAttendance: builder.mutation<void, { id: number; periodId: number }>({
      query: ({ id, periodId }) => ({
        url: `lessons/${id}/periods/${periodId}/reset`,
        method: "POST",
      }),
      invalidatesTags: ["Lesson"],
    }),
    consumeStudentCard: builder.mutation<
      void,
      { id: number; periodId: number; studentId: number; studentCardId: number }
    >({
      query: ({ id, periodId, studentId, studentCardId }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance/${studentId}/consume`,
        method: "POST",
        body: { studentCardId },
      }),
      invalidatesTags: ["Lesson", "StudentCard", "Card", "Attendance", "AttendanceRecord"],
    }),
    getLessonTrials: builder.query<TrialRoster, { id: number }>({
      query: ({ id }) => `lessons/${id}/trials`,
      // 點名（Attendance）會把「已登記」變成「已上課」，買卡／刪卡也會動到名單。
      providesTags: ["Lesson", "StudentCard", "Attendance"],
    }),
    registerTrial: builder.mutation<
      { studentCardId: number; studentId: number },
      { id: number } & RegisterTrialBody
    >({
      query: ({ id, ...body }) => ({ url: `lessons/${id}/trials`, method: "POST", body }),
      invalidatesTags: ["Lesson", "Student", "StudentCard", "Card"],
    }),
    getLessonStudents: builder.query<LessonStudent[], { id: number }>({
      query: ({ id }) => ({
        url: `lessons/${id}/students`,
        method: "GET",
      }),
      // "StudentCard" as well as "Lesson": the payload now carries cardStatus,
      // so buying a card (which invalidates StudentCard) has to refetch the
      // roster — otherwise the triage row that prompted the purchase stays put.
      providesTags: ["Lesson", "StudentCard"],
    }),
    createPeriod: builder.mutation<
      void,
      { id: number; startTime: string; endTime: string }
    >({
      query: ({ id, startTime, endTime }) => ({
        url: `lessons/${id}/periods`,
        method: "POST",
        body: { startTime, endTime },
      }),
      invalidatesTags: ["Lesson"],
    }),
    /** Several periods in one request (the list's "＋下一堂"); reopens an ended lesson. */
    createPeriods: builder.mutation<
      void,
      { id: number; periods: { startTime: string; endTime: string }[] }
    >({
      query: ({ id, periods }) => ({
        url: `lessons/${id}/periods`,
        method: "POST",
        body: { periods },
      }),
      invalidatesTags: ["Lesson"],
    }),
    /** End by hand (how an ongoing lesson reaches 已結束). */
    endLesson: builder.mutation<void, number>({
      query: (id) => ({ url: `lessons/${id}/end`, method: "POST" }),
      invalidatesTags: ["Lesson"],
    }),
    reopenLesson: builder.mutation<void, number>({
      query: (id) => ({ url: `lessons/${id}/end`, method: "DELETE" }),
      invalidatesTags: ["Lesson"],
    }),
    /** Re-date a period; its attendance records move with it (see the PATCH route). */
    updatePeriod: builder.mutation<
      void,
      { id: number; periodId: number; startTime: string; endTime: string }
    >({
      query: ({ id, periodId, startTime, endTime }) => ({
        url: `lessons/${id}/periods/${periodId}`,
        method: "PATCH",
        body: { startTime, endTime },
      }),
      invalidatesTags: ["Lesson"],
    }),
    deletePeriod: builder.mutation<void, { id: number; periodId: number }>({
      query: ({ id, periodId }) => ({
        url: `lessons/${id}/periods/${periodId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Lesson"],
    }),
    getUnbindAttendanceRecords: builder.query<UnbindAttendanceRecord[], void>({
      query: () => ({
        url: "attendance-records/unbind",
        method: "GET",
      }),
      providesTags: ["AttendanceRecord"],
    }),
    deleteLesson: builder.mutation<void, number>({
      query: (id) => ({
        url: `lessons/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Lesson"],
    }),
  }),
});

export const {
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useGetLessonsQuery,
  useGetLessonQuery,
  useGetCalendarPeriodsQuery,
  useGetLessonAgendaQuery,
  useLazyGetAttendanceQuery,
  useLazyCheckStudentCardsQuery,
  useTakeAttendanceMutation,
  useUpdateAttendanceMutation,
  useGetAttendanceQuery,
  useResetAttendanceMutation,
  useConsumeStudentCardMutation,
  useGetLessonStudentsQuery,
  useGetLessonTrialsQuery,
  useRegisterTrialMutation,
  useCreatePeriodMutation,
  useCreatePeriodsMutation,
  useEndLessonMutation,
  useReopenLessonMutation,
  useUpdatePeriodMutation,
  useDeletePeriodMutation,
  useGetUnbindAttendanceRecordsQuery,
} = lessonsApi;
