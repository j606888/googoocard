import { Student } from "./students";
import { api } from "../api";
import { Card } from "./cards";
import { Teacher } from "./teachers";
import { DanceType } from "@prisma/client";

export interface Lesson {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  students: Student[];
  periods: Period[];
  teachers: Teacher[];
  danceType: DanceType;
  cards: Card[];
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
  danceType: DanceType;
  status: string;
  studentCount: number;
  teachers: { id: number; name: string }[];
  cardIds: number[];
  totalPeriods: number;
  attendedCount: number;
  /** Earliest upcoming session start (ISO), or null — informational "next class". */
  nextSessionDate: string | null;
  nextSessionPeriodId: number | null;
  /** Periods already due but not yet checked — drives the 點名 CTA / warning. */
  dueForAttendanceCount: number;
  dueForAttendancePeriodId: number | null;
  dueForAttendanceDate: string | null;
  lastPeriodStart: string | null;
  lastPeriodEnd: string | null;
}

/** One session (LessonPeriod) as returned by GET /lessons/calendar. */
export interface CalendarPeriod {
  periodId: number;
  lessonId: number;
  lessonName: string;
  danceType: DanceType;
  lessonStatus: string;
  startTime: string;
  endTime: string;
  attendanceTaken: boolean;
  attendeeCount: number;
}

export interface GetLessonsArgs {
  tab: string;
  sort: string;
  search?: string;
  danceType?: DanceType | null;
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
  danceType: DanceType;
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
    startTime: string;
    attendanceStatus: "not_started" | "attended" | "absent";
  }[];
}

const lessonsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLessons: builder.query<
      {
        lessons: LessonSummary[];
        tabsCount: { inProgress: number; finished: number };
        hasNextPage: boolean;
        availableDanceTypes: DanceType[];
      },
      GetLessonsArgs
    >({
      query: ({ tab, sort, search, danceType, page }) => {
        const params = new URLSearchParams({ tab, sort });
        if (search) params.set("search", search);
        if (danceType) params.set("danceType", danceType);
        if (page !== undefined) params.set("page", String(page));
        return `lessons?${params.toString()}`;
      },
      providesTags: ["Lesson"],
    }),
    getLesson: builder.query<Lesson, string | number>({
      query: (id) => `lessons/${id}`,
      providesTags: ["Lesson"],
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
    getLessonStudents: builder.query<LessonStudent[], { id: number }>({
      query: ({ id }) => ({
        url: `lessons/${id}/students`,
        method: "GET",
      }),
      providesTags: ["Lesson"],
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
  useLazyCheckStudentCardsQuery,
  useTakeAttendanceMutation,
  useUpdateAttendanceMutation,
  useGetAttendanceQuery,
  useResetAttendanceMutation,
  useConsumeStudentCardMutation,
  useGetLessonStudentsQuery,
  useCreatePeriodMutation,
  useDeletePeriodMutation,
  useGetUnbindAttendanceRecordsQuery,
} = lessonsApi;
