import { api } from "../api";

export interface Classroom {
  id: number;
  name: string;
}

const classroomsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getClassrooms: builder.query<{ classrooms: Classroom[], currentClassroomId: number }, void>({
      query: () => 'classrooms',
      providesTags: ['Classroom'],
    }),
  }),
});

export const { useGetClassroomsQuery } = classroomsApi;