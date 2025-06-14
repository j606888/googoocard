import { api } from '../api';

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
}

const teachersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeachers: builder.query<Teacher[], void>({
      query: () => 'teachers',
      providesTags: ['Teacher'],
    }),
  
    createTeacher: builder.mutation<Teacher, Omit<Teacher, 'id'>>({
      query: (teacher) => ({
        url: 'teachers',
        method: 'POST',
        body: teacher,
      }),
      invalidatesTags: ['Teacher'],
    }),
  }),
});

export const {
  useGetTeachersQuery,
  useCreateTeacherMutation,
} = teachersApi;