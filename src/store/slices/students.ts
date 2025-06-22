import { api } from "../api";

export interface Student {
  id: number;
  name: string;
  avatarUrl: string;
  createdAt: string;
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
}

const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], void>({
      query: () => "students",
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
  }),
});

export const {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useDeleteStudentMutation,
  useGetStudentCardsQuery,
} = studentsApi;
