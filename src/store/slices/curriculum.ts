import { api } from "../api";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { Reaction, Talk, TalkComment } from "@/domains/curriculum/talk";
import type { SkillChangeKind } from "@/domains/curriculum/skillTree";

export interface SkillCategory {
  id: number;
  name: string;
  /** DANCE_STYLE_COLORS key */
  color: string;
  /** SKILL_CATEGORY_ICONS key */
  icon: string;
  sortOrder: number;
}

export interface SkillTier {
  id: number;
  label: string;
  sortOrder: number;
}

export interface Skill {
  id: number;
  /** null ＝ 待定區 */
  categoryId: number | null;
  tierId: number | null;
  name: string;
  fullName: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  archivedAt: string | null;
  createdBy: { id: number; name: string } | null;
}

/** GET curriculum/[danceStyleId]/tree */
export interface SkillTree {
  danceStyle: DanceStyleSummary;
  categories: SkillCategory[];
  tiers: SkillTier[];
  /** On the tree (has a 分類), not archived. */
  skills: Skill[];
  /** 待定區 */
  drafts: Skill[];
  archived: Skill[];
}

/** GET curriculum/styles — one per live 舞種. */
export interface CurriculumStyle {
  danceStyle: DanceStyleSummary;
  hasTree: boolean;
  skillCount: number;
  draftCount: number;
  /** 討論中: comments, no 結論 */
  openCount: number;
  /** Skills with news for you */
  freshCount: number;
}

export interface SkillChange {
  id: number;
  kind: SkillChangeKind;
  skillName: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  actor: { id: number; name: string } | null;
}

type StyleArg = { danceStyleId: number };

const curriculumApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurriculumStyles: builder.query<CurriculumStyle[], void>({
      query: () => "curriculum/styles",
      providesTags: ["SkillTree", "SkillTalk", "DanceStyle"],
    }),
    getSkillTree: builder.query<SkillTree, StyleArg>({
      query: ({ danceStyleId }) => `curriculum/${danceStyleId}/tree`,
      providesTags: ["SkillTree"],
    }),
    createSkillTree: builder.mutation<SkillTree, StyleArg & { template: "default" | "blank" }>({
      query: ({ danceStyleId, template }) => ({
        url: `curriculum/${danceStyleId}/tree`,
        method: "POST",
        body: { template },
      }),
      invalidatesTags: ["SkillTree"],
    }),

    createSkillCategory: builder.mutation<SkillCategory, StyleArg & Pick<SkillCategory, "name" | "color" | "icon">>({
      query: ({ danceStyleId, ...body }) => ({ url: `curriculum/${danceStyleId}/categories`, method: "POST", body }),
      invalidatesTags: ["SkillTree"],
    }),
    updateSkillCategory: builder.mutation<SkillCategory, { id: number } & Partial<Pick<SkillCategory, "name" | "color" | "icon">>>({
      query: ({ id, ...body }) => ({ url: `curriculum/categories/${id}`, method: "PATCH", body }),
      invalidatesTags: ["SkillTree"],
    }),
    deleteSkillCategory: builder.mutation<void, { id: number; moveTo: number | null }>({
      query: ({ id, moveTo }) => ({ url: `curriculum/categories/${id}`, method: "DELETE", body: { moveTo } }),
      invalidatesTags: ["SkillTree"],
    }),
    moveSkillCategory: builder.mutation<void, { id: number; dir: -1 | 1 }>({
      query: ({ id, dir }) => ({ url: `curriculum/categories/${id}/move`, method: "POST", body: { dir } }),
      invalidatesTags: ["SkillTree"],
    }),

    createSkillTier: builder.mutation<SkillTier, StyleArg & { label: string }>({
      query: ({ danceStyleId, label }) => ({ url: `curriculum/${danceStyleId}/tiers`, method: "POST", body: { label } }),
      invalidatesTags: ["SkillTree"],
    }),
    updateSkillTier: builder.mutation<SkillTier, { id: number; label: string }>({
      query: ({ id, label }) => ({ url: `curriculum/tiers/${id}`, method: "PATCH", body: { label } }),
      invalidatesTags: ["SkillTree"],
    }),
    deleteSkillTier: builder.mutation<void, { id: number; moveTo: number | null }>({
      query: ({ id, moveTo }) => ({ url: `curriculum/tiers/${id}`, method: "DELETE", body: { moveTo } }),
      invalidatesTags: ["SkillTree"],
    }),
    moveSkillTier: builder.mutation<void, { id: number; dir: -1 | 1 }>({
      query: ({ id, dir }) => ({ url: `curriculum/tiers/${id}/move`, method: "POST", body: { dir } }),
      invalidatesTags: ["SkillTree"],
    }),

    createSkill: builder.mutation<
      Skill,
      StyleArg & { name: string; fullName?: string; description?: string; categoryId?: number; tierId?: number }
    >({
      query: ({ danceStyleId, ...body }) => ({ url: `curriculum/${danceStyleId}/skills`, method: "POST", body }),
      invalidatesTags: ["SkillTree"],
    }),
    addDrafts: builder.mutation<{ added: Skill[]; skipped: string[] }, StyleArg & { text: string }>({
      query: ({ danceStyleId, text }) => ({ url: `curriculum/${danceStyleId}/drafts`, method: "POST", body: { text } }),
      invalidatesTags: ["SkillTree"],
    }),
    placeDrafts: builder.mutation<
      { placed: number[]; skipped: string[] },
      StyleArg & { ids: number[]; categoryId: number; tierId: number }
    >({
      query: ({ danceStyleId, ...body }) => ({ url: `curriculum/${danceStyleId}/drafts/place`, method: "POST", body }),
      invalidatesTags: ["SkillTree"],
    }),
    updateSkill: builder.mutation<
      Skill,
      { id: number; name?: string; fullName?: string; description?: string; categoryId?: number; tierId?: number | null }
    >({
      query: ({ id, ...body }) => ({ url: `curriculum/skills/${id}`, method: "PATCH", body }),
      invalidatesTags: ["SkillTree"],
    }),
    /** On the tree → archived; a 待定 card → deleted with its comments. */
    removeSkill: builder.mutation<{ deleted: boolean }, { id: number }>({
      query: ({ id }) => ({ url: `curriculum/skills/${id}`, method: "DELETE" }),
      invalidatesTags: ["SkillTree", "SkillTalk"],
    }),
    restoreSkill: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({ url: `curriculum/skills/${id}/restore`, method: "POST" }),
      invalidatesTags: ["SkillTree"],
    }),
    getSkillHistory: builder.query<SkillChange[], { id: number }>({
      query: ({ id }) => `curriculum/skills/${id}/history`,
      providesTags: ["SkillTree"],
    }),

    getTalk: builder.query<Talk, StyleArg>({
      query: ({ danceStyleId }) => `curriculum/${danceStyleId}/talk`,
      providesTags: ["SkillTalk"],
    }),
    postComment: builder.mutation<TalkComment, { skillId: number; text: string; parentId?: number }>({
      query: ({ skillId, ...body }) => ({ url: `curriculum/skills/${skillId}/comments`, method: "POST", body }),
      invalidatesTags: ["SkillTalk"],
    }),
    editComment: builder.mutation<TalkComment, { id: number; text: string }>({
      query: ({ id, text }) => ({ url: `curriculum/comments/${id}`, method: "PATCH", body: { text } }),
      invalidatesTags: ["SkillTalk"],
    }),
    deleteComment: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({ url: `curriculum/comments/${id}`, method: "DELETE" }),
      invalidatesTags: ["SkillTalk"],
    }),
    reactToComment: builder.mutation<{ kind: Reaction | null }, { id: number; kind: Reaction }>({
      query: ({ id, kind }) => ({ url: `curriculum/comments/${id}/reaction`, method: "PUT", body: { kind } }),
      invalidatesTags: ["SkillTalk"],
    }),
    setConclusion: builder.mutation<void, { id: number; on: boolean }>({
      query: ({ id, on }) => ({ url: `curriculum/comments/${id}/conclusion`, method: on ? "PUT" : "DELETE" }),
      invalidatesTags: ["SkillTalk"],
    }),
    /** Opening a skill's 討論. Optimistic — the red dot goes at once, nothing is refetched. */
    markSkillRead: builder.mutation<void, StyleArg & { skillId: number }>({
      query: ({ skillId }) => ({ url: `curriculum/skills/${skillId}/read`, method: "POST" }),
      async onQueryStarted({ danceStyleId, skillId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          curriculumApi.util.updateQueryData("getTalk", { danceStyleId }, (draft) => {
            draft.readAt[skillId] = new Date().toISOString();
            draft.mentioned = draft.mentioned.filter((id) => id !== skillId);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetCurriculumStylesQuery,
  useGetSkillTreeQuery,
  useCreateSkillTreeMutation,
  useCreateSkillCategoryMutation,
  useUpdateSkillCategoryMutation,
  useDeleteSkillCategoryMutation,
  useMoveSkillCategoryMutation,
  useCreateSkillTierMutation,
  useUpdateSkillTierMutation,
  useDeleteSkillTierMutation,
  useMoveSkillTierMutation,
  useCreateSkillMutation,
  useAddDraftsMutation,
  usePlaceDraftsMutation,
  useUpdateSkillMutation,
  useRemoveSkillMutation,
  useRestoreSkillMutation,
  useGetSkillHistoryQuery,
  useGetTalkQuery,
  usePostCommentMutation,
  useEditCommentMutation,
  useDeleteCommentMutation,
  useReactToCommentMutation,
  useSetConclusionMutation,
  useMarkSkillReadMutation,
} = curriculumApi;
