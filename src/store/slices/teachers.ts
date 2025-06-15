import { api } from '../api';

export interface Teacher {
  id: string;
  name: string;
}

const teachersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeachers: builder.query<Teacher[], void>({
      query: () => 'teachers',
      providesTags: ['Teacher'],
    }),
  
    createTeacher: builder.mutation<Teacher, { name: string, classroomId: number }>({
      query: ({ name, classroomId }) => ({
        url: 'teachers',
        method: 'POST',
        body: { name, classroomId },
      }),
      invalidatesTags: ['Teacher'],
    }),
    deleteTeacher: builder.mutation<Teacher, { id: string }>({
      query: ({ id }) => ({
        url: `teachers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Teacher'],
    }),
  }),
});

export const {
  useGetTeachersQuery,
  useCreateTeacherMutation,
  useDeleteTeacherMutation,
} = teachersApi;