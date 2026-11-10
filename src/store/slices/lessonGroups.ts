import { api } from "../api";

export interface LessonGroup {
  id: number;
  name: string;
  lessonCount: number;
}

const lessonGroupsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLessonGroups: builder.query<LessonGroup[], void>({
      query: () => "lesson-groups",
      providesTags: ["LessonGroup"],
    }),
    createLessonGroup: builder.mutation<LessonGroup, { name: string }>({
      query: ({ name }) => ({
        url: "lesson-groups",
        method: "POST",
        body: { name },
      }),
      invalidatesTags: ["LessonGroup"],
    }),
    renameLessonGroup: builder.mutation<LessonGroup, { id: number; name: string }>({
      query: ({ id, name }) => ({
        url: `lesson-groups/${id}`,
        method: "PUT",
        body: { name },
      }),
      invalidatesTags: ["LessonGroup", "Lesson"],
    }),
    /** 整理課種：一次把好幾門課歸到各自的課種，課種照名稱找、沒有就建。 */
    organizeLessonGroups: builder.mutation<
      { updated: number },
      { series: { name: string; lessonIds: number[] }[] }
    >({
      query: (body) => ({ url: "lesson-groups/organize", method: "POST", body }),
      invalidatesTags: ["LessonGroup", "Lesson"],
    }),
    deleteLessonGroup: builder.mutation<void, number>({
      query: (id) => ({
        url: `lesson-groups/${id}`,
        method: "DELETE",
      }),
      // Member lessons fall back to 未分類 (groupId set to null server-side),
      // so lesson lists/summaries need refetching too.
      invalidatesTags: ["LessonGroup", "Lesson"],
    }),
  }),
});

export const {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
  useRenameLessonGroupMutation,
  useDeleteLessonGroupMutation,
  useOrganizeLessonGroupsMutation,
} = lessonGroupsApi;
