import { api } from "../api";
import { Card } from "./cards";
import { Classroom } from "./classrooms";

export interface Student {
  id: number;
  name: string;
  randomKey: string;
  avatarUrl: string;
  createdAt: string;
  classroom: Classroom;
  studentCards: StudentCardWithCard[];
}

export interface Event {
  id: number;
  title: string;
  description: string;
  createdAt: string;
}

export interface StudentWithDetail extends Student {
  overview: {
    lastAttendAt: string | null;
    cardCount: number;
    attendLessonCount: number;
    totalSpend: number;
    totalSaved: number;
  }
  attendancesByLesson: {
    lessonId: number;
    lessonName: string;
    totalPeriods: number;
    lessonPeriodIds: number[];
    attendances: {
      periodNumber: number;
      periodStartTime: number;
    }[]
    studentAttendances: {
      periodId: number;
      periodStartTime: string;
      periodAttendantCheck: boolean;
      studentAttend: boolean;
    }[]
  }[]
  attendancesByDate: {
    date: number;
    attendances: {
      lessonName: string;
      periodNumber: number;
      totalPeriods: number;
    }[]
  }[]
}

export interface StudentCardWithCard extends StudentCard {
  card: Card;
  attendanceRecords: {
    lessonName: string;
    periodStartTime: number;
  }[]
}

export interface StudentCard {
  id: number;
  studentId: number;
  cardId: number;
  basePrice: number;
  finalPrice: number;
  totalSessions: number;
  remainingSessions: number;
  createdAt: string;
  updatedAt: string;
  expiredAt: string | null;
}

const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], { query?: string } | void>({
      query: ({ query } = {}) => `students${query ? `?query=${query}` : ""}`,
      providesTags: ["Student"],
    }),
    getPublicStudent: builder.query<StudentWithDetail, { randomKey: string }>({
      query: ({ randomKey }) => `public-students/${randomKey}`,
      providesTags: ["Student"],
    }),
    createStudent: builder.mutation<
      Student,
      { name: string; avatarUrl: string }
    >({
      query: ({ name, avatarUrl }) => ({
        url: "students",
        method: "POST",
        body: { name, avatarUrl },
      }),
      invalidatesTags: ["Student"],
    }),
    updateStudent: builder.mutation<Student, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `students/${id}`,
        method: "PATCH",
        body: { name },
      }),
      invalidatesTags: ["Student"],
    }),
    deleteStudent: builder.mutation<Student, { id: string }>({
      query: ({ id }) => ({
        url: `students/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Student"],
    }),
    getStudentCards: builder.query<StudentCard[], { id: number }>({
      query: ({ id }) => `students/${id}/student-cards`,
      providesTags: ["StudentCard"],
    }),
    createStudentCard: builder.mutation<StudentCard, { id: number; cardId: number; sessions: number; price: number }>({
      query: ({ id, cardId, sessions, price }) => ({
        url: `students/${id}/student-cards`,
        method: "POST",
        body: { cardId, sessions, price },
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    expireStudentCard: builder.mutation<StudentCard, { id: number; studentCardId: number }>({
      query: ({ id, studentCardId }) => ({
        url: `students/${id}/student-cards/${studentCardId}/expire`,
        method: "POST",
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    getStudent: builder.query<StudentWithDetail, { id: number }>({
      query: ({ id }) => `students/${id}`,
      providesTags: ["Student"],
    }),
    getStudentCardsByLesson: builder.query<StudentCardWithCard[], { studentId : number; lessonId: number }>({
      query: ({ studentId, lessonId }) => `lessons/${lessonId}/students/${studentId}/student-cards`,
      providesTags: ["StudentCard"],
    }),
    getStudentEvents: builder.query<Event[], { id: number }>({
      query: ({ id }) => `students/${id}/events`,
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetPublicStudentQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useGetStudentCardsQuery,
  useCreateStudentCardMutation,
  useGetStudentQuery,
  useExpireStudentCardMutation,
  useGetStudentCardsByLessonQuery,
  useGetStudentEventsQuery,
} = studentsApi;
