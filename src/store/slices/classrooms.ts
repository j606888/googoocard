import { api, TAG_TYPES } from "../api";

export interface Classroom {
  id: number;
  name: string;
}

export interface CheckinKey {
  classroomName: string;
  key: string;
  url: string;
}

const classroomsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getClassrooms: builder.query<
      { classrooms: Classroom[]; currentClassroomId: number },
      void
    >({
      query: () => "classrooms",
      providesTags: ["Classroom"],
    }),
    createClassroom: builder.mutation<Classroom, { name: string }>({
      query: ({ name }) => ({
        url: "classrooms",
        method: "POST",
        body: { name },
      }),
      invalidatesTags: ["Classroom"],
    }),
    switchClassroom: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `classrooms/${id}/switch`,
        method: "POST",
      }),
      invalidatesTags: TAG_TYPES,
    }),
    getCheckinKey: builder.query<CheckinKey, void>({
      query: () => "checkin-key",
      providesTags: ["Classroom"],
    }),
    rotateCheckinKey: builder.mutation<CheckinKey, void>({
      query: () => ({
        url: "checkin-key",
        method: "POST",
      }),
      invalidatesTags: ["Classroom"],
    }),
  }),
});

export const {
  useGetClassroomsQuery,
  useCreateClassroomMutation,
  useSwitchClassroomMutation,
  useGetCheckinKeyQuery,
  useRotateCheckinKeyMutation,
} = classroomsApi;
