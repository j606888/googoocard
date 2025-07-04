import { api } from "../api";

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
    deleteInviteToken: builder.mutation<void, { id: number }>({
      query: ({ id }) => ({
        url: `invite-tokens/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["InviteToken"],
    }),
    joinInviteToken: builder.mutation<void, { token: string }>({
      query: ({ token }) => ({
        url: `invite-tokens/${token}/join`,
        method: "POST",
      }),
      invalidatesTags: ["InviteToken"],
    }),
  }),
});

export const {
  useGetMembershipsQuery,
  useCreateInviteTokenMutation,
  useGetInviteTokensQuery,
  useDeleteInviteTokenMutation,
  useJoinInviteTokenMutation,
} = membershipsApi;
