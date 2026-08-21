import { DanceType } from "@prisma/client";
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
  createdAt: string;
  classroom: Classroom;
  studentCards: StudentCardWithCard[];
  tags: StudentTag[];
  isInActiveLesson: boolean;
  activeLessonIds: number[];
  danceQualifications: DanceType[];
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
  purchaseSource: "STAFF" | "STUDENT";
  note: string | null;
  origin: "PURCHASE" | "CONVERSION";
  convertedToId: number | null;
  isPaid: boolean;
  paidAt: string | null;
  purchasedBy?: { name: string } | null;
  paidBy?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  expiredAt: string | null;
}

export interface UnpaidStudentCard {
  id: number;
  studentId: number;
  finalPrice: number;
  createdAt: string;
  student: { id: number; name: string; avatarUrl: string };
  card: { name: string };
  purchasedBy?: { name: string } | null;
}

const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<
      Student[],
      { query?: string; needsRenewal?: boolean; sort?: "name" | "number" } | void
    >({
      query: ({ query, needsRenewal, sort } = {}) => {
        const searchParams = new URLSearchParams();
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
    updateStudent: builder.mutation<Student, { id: number; name: string; note?: string; avatarUrl: string; danceQualifications: DanceType[] }>({
      query: ({ id, name, note, avatarUrl, danceQualifications }) => ({
        url: `students/${id}`,
        method: "PATCH",
        body: { name, note, avatarUrl, danceQualifications },
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
    createStudentCard: builder.mutation<StudentCard, { id: number; cardId: number; sessions: number; price: number; lessonId?: number; isPaid?: boolean }>({
      query: ({ id, cardId, sessions, price, lessonId, isPaid }) => ({
        url: `students/${id}/student-cards`,
        method: "POST",
        body: { cardId, sessions, price, lessonId, isPaid },
      }),
      invalidatesTags: ["StudentCard", "Student"],
    }),
    confirmStudentCardPayment: builder.mutation<StudentCard, { id: number; studentCardId: number }>({
      query: ({ id, studentCardId }) => ({
        url: `students/${id}/student-cards/${studentCardId}/confirm-payment`,
        method: "POST",
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
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
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
