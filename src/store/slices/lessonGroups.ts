import { api } from "../api";

export interface LessonGroup {
  id: number;
  name: string;
  lessonCount: number;
}

export interface LessonGroupStudents {
  lessons: {
    lessonId: number;
    students: { id: number; name: string; avatarUrl: string }[];
  }[];
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
    /**
     * 翻新精靈：一次把好幾門課歸到各自的課種（照名稱找、沒有就建），
     * 並設好每一期的分部與小幫手。被搬空的舊群組會刪掉。
     */
    organizeLessonGroups: builder.mutation<
      { updated: number; removedGroups: number },
      {
        series: { name: string; lessonIds: number[] }[];
        ungroupLessonIds?: number[];
        lessons?: { id: number; locationId: number | null; assistantIds: number[] }[];
      }
    >({
      query: (body) => ({ url: "lesson-groups/organize", method: "POST", body }),
      invalidatesTags: ["LessonGroup", "Lesson", "Teacher"],
    }),
    /** 課種頁：每一期上過課的學生。 */
    getLessonGroupStudents: builder.query<LessonGroupStudents, number>({
      query: (id) => `lesson-groups/${id}/students`,
      providesTags: ["LessonGroup", "Lesson"],
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
  useGetLessonGroupStudentsQuery,
} = lessonGroupsApi;
