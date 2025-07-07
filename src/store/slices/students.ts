import { api } from "../api";
import { Card } from "./cards";

export interface Student {
  id: number;
  name: string;
  avatarUrl: string;
  createdAt: string;
  studentCards: StudentCardWithCard[];
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
      periodStartTime: number;
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
  paid: boolean;
}

const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], { query?: string } | void>({
      query: ({ query } = {}) => `students${query ? `?query=${query}` : ""}`,
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
    createStudentCard: builder.mutation<StudentCard, { id: number; cardId: number; sessions: number; price: number; paid: boolean }>({
      query: ({ id, cardId, sessions, price, paid }) => ({
        url: `students/${id}/student-cards`,
        method: "POST",
        body: { cardId, sessions, price, paid },
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
    markStudentCardAsPaid: builder.mutation<StudentCard, { id: number; studentCardId: number }>({
      query: ({ id, studentCardId }) => ({
        url: `students/${id}/student-cards/${studentCardId}/mark-as-paid`,
        method: "POST",
      }),
      invalidatesTags: ["StudentCard", "Student", "Card"],
    }),
    getStudent: builder.query<StudentWithDetail, { id: number }>({
      query: ({ id }) => `students/${id}`,
      providesTags: ["Student"],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useDeleteStudentMutation,
  useGetStudentCardsQuery,
  useCreateStudentCardMutation,
  useGetStudentQuery,
  useExpireStudentCardMutation,
  useMarkStudentCardAsPaidMutation,
} = studentsApi;
