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
  studentIds: number[];
  answers: Answer[];
}

export interface AttendanceRecord {
  studentId: number;
  studentName: string;
  studentAvatarUrl: string;
  cardId: number;
  cardName: string;
  remainingSessions: number;
  income: number;
}

const lessonsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLessons: builder.query<Lesson[], void>({
      query: () => "lessons",
    }),
    getLesson: builder.query<Lesson, string | number>({
      query: (id) => `lessons/${id}`,
    }),
    createLesson: builder.mutation<void, DraftLesson>({
      query: (draftLesson) => ({
        url: "lessons",
        method: "POST",
        body: draftLesson,
      }),
    }),
    checkStudentCards: builder.query<{ invalidStudentIds: number[] }, { id: number; studentIds: number[] }>({
      query: ({ id, studentIds }) => ({
        url: `lessons/${id}/check-student-cards`,
        method: "POST",
        body: { studentIds },
      }),
      providesTags: ["StudentCard"],
    }),
    takeAttendance: builder.mutation<void, { id: number; periodId: number; studentIds: number[] }>({
      query: ({ id, periodId, studentIds }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance`,
        method: "POST",
        body: { studentIds },
      }),
    }),
    getAttendance: builder.query<AttendanceRecord[], { id: number; periodId: number }>({
      query: ({ id, periodId }) => ({
        url: `lessons/${id}/periods/${periodId}/attendance`,
        method: "GET",
      }),
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
} = lessonsApi;
