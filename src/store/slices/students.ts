import { api } from "../api";

export interface Student {
  id: string;
  name: string;
  avatarUrl: string;
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
  }),
});

export const {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useDeleteStudentMutation,
} = studentsApi;
