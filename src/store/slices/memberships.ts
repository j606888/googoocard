import { api, TAG_TYPES } from "../api";

export interface Membership {
  id: number;
  role: string;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface InviteToken {
  id: number;
  token: string;
  maxUses: number;
  uses: number;
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
    createInviteToken: builder.mutation<void, { maxUses: number }>({
      query: ({ maxUses }) => ({
        url: "invite-tokens",
        method: "POST",
        body: { maxUses },
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
    removeMembership: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({
        url: `memberships/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Membership"],
    }),
    // The caller drops to assistant and the target becomes owner; the classroom
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
    getInviteToken: builder.query<InviteToken, { token: string }>({
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
  useCreateInviteTokenMutation,
  useGetInviteTokensQuery,
  useDeleteInviteTokenMutation,
  useGetInviteTokenQuery,
  useJoinInviteTokenMutation,
} = membershipsApi;
