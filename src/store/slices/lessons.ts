import { Student } from "./students";
import { api } from "../api";
import { Card } from "./cards";
import { Teacher } from "./teachers";

export interface Lesson {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  students: Student[];
  periods: Period[];
  teachers: Teacher[];
  cards: Card[];
}

export interface Period {
  id: number;
  lessonId: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
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
  periods: {
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
  uncheckedType: "no_card" | "multiple_cards" | "not_checked";
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
        lessons: Lesson[];
        tabsCount: { inProgress: number; finished: number };
      },
      { tab: string; sort: string }
    >({
      query: ({ tab, sort }) => `lessons?tab=${tab}&sort=${sort}`,
      providesTags: ["Lesson"],
    }),
    getLesson: builder.query<Lesson, string | number>({
      query: (id) => `lessons/${id}`,
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
  }),
});

export const {
  useCreateLessonMutation,
  useGetLessonsQuery,
  useGetLessonQuery,
  useLazyCheckStudentCardsQuery,
  useTakeAttendanceMutation,
  useGetAttendanceQuery,
  useResetAttendanceMutation,
  useConsumeStudentCardMutation,
  useGetLessonStudentsQuery,
  useCreatePeriodMutation,
  useDeletePeriodMutation,
  useGetUnbindAttendanceRecordsQuery,
} = lessonsApi;
