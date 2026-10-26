import { api, TAG_TYPES } from "../api";
import type { AssignableRole } from "@/lib/roles";
import type { TeacherSummary } from "./teachers";

export interface Membership {
  id: number;
  /** "owner" | "admin" | "teacher" | "assistant" — see src/lib/roles.ts. */
  role: string;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  /** The Teacher row this member is (Teacher.userId), or null. */
  teacher: TeacherSummary | null;
}

export interface InviteToken {
  id: number;
  token: string;
  maxUses: number;
  uses: number;
  role: string;
  classroomId: number;
  teacher: TeacherSummary | null;
}

/** GET invite-tokens/[token] — the public lookup on the join page. */
export interface InviteTokenLookup {
  id: number;
  token: string;
  role: string;
  classroomId: number;
  classroom: {
    id: number;
    name: string;
  };
}

const membershipsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMemberships: builder.query<Membership[], void>({
      query: () => "memberships",
      providesTags: ["Membership"],
    }),
    createInviteToken: builder.mutation<
      InviteToken,
      { maxUses: number; role: AssignableRole; teacherId?: number | null }
    >({
      query: (body) => ({
        url: "invite-tokens",
        method: "POST",
        body,
      }),
      invalidatesTags: ["InviteToken"],
    }),
    getInviteTokens: builder.query<InviteToken[], void>({
      query: () => "invite-tokens",
      providesTags: ["InviteToken"],
    }),
    joinInviteToken: builder.mutation<void, { token: string }>({
      query: ({ token }) => ({
        url: `invite-tokens/${token}/join`,
        method: "POST",
      }),
      invalidatesTags: TAG_TYPES,
    }),
    // A teacher link changes what the lessons page shows and who's linked on
    // the teachers list, hence "Teacher".
    updateMembership: builder.mutation<
      void,
      { id: number; role?: AssignableRole; teacherId?: number | null }
    >({
      query: ({ id, ...body }) => ({
        url: `memberships/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Membership", "Teacher"],
    }),
    removeMembership: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({
        url: `memberships/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Membership", "Teacher"],
    }),
    // The caller drops to admin and the target becomes owner; the classroom
    // list shows the owner too, hence "Classroom".
    transferOwnership: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({
        url: `memberships/${id}/transfer-ownership`,
        method: "POST",
      }),
      invalidatesTags: ["Membership", "Classroom"],
    }),
    deleteInviteToken: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({
        url: `invite-tokens/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["InviteToken"],
    }),
    getInviteToken: builder.query<InviteTokenLookup, { token: string }>({
      query: ({ token }) => ({
        url: `invite-tokens/${token}`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useGetMembershipsQuery,
  useTransferOwnershipMutation,
  useRemoveMembershipMutation,
  useUpdateMembershipMutation,
  useCreateInviteTokenMutation,
  useGetInviteTokensQuery,
  useDeleteInviteTokenMutation,
  useGetInviteTokenQuery,
  useJoinInviteTokenMutation,
} = membershipsApi;
