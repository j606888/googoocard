import { api, TAG_TYPES } from "../api";

export interface Classroom {
  id: number;
  name: string;
  /** The signed-in user's role in this classroom: "owner" | "assistant". */
  role: string;
}

export interface ClassroomDetail {
  id: number;
  name: string;
  counts: { students: number; lessons: number; studentCards: number };
}

/** Where to send the user after they leave or delete: null = no classrooms left. */
export interface ClassroomExitResult {
  nextClassroomId: number | null;
}

export interface CheckinKey {
  classroomName: string;
  key: string;
  url: string;
}

const classroomsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getClassrooms: builder.query<
      { classrooms: Classroom[]; currentClassroomId: number | null },
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
    getClassroom: builder.query<ClassroomDetail, { id: number }>({
      query: ({ id }) => `classrooms/${id}`,
      providesTags: ["Classroom"],
    }),
    deleteClassroom: builder.mutation<ClassroomExitResult, { id: number }>({
      query: ({ id }) => ({
        url: `classrooms/${id}`,
        method: "DELETE",
      }),
      // Everything on screen belonged to the classroom that just went away.
      invalidatesTags: TAG_TYPES,
    }),
    leaveClassroom: builder.mutation<ClassroomExitResult, { id: number }>({
      query: ({ id }) => ({
        url: `classrooms/${id}/leave`,
        method: "POST",
      }),
      invalidatesTags: TAG_TYPES,
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
  useGetClassroomQuery,
  useCreateClassroomMutation,
  useDeleteClassroomMutation,
  useLeaveClassroomMutation,
  useSwitchClassroomMutation,
  useGetCheckinKeyQuery,
  useRotateCheckinKeyMutation,
} = classroomsApi;
