import { api, TAG_TYPES } from "../api";

export interface Me {
  id: number;
  name: string;
  email: string;
}

export type TodoType = "UNPAID_CARD" | "NEEDS_RENEWAL" | "UNBOUND_ATTENDANCE";
export type NotificationPreferences = Record<TodoType, boolean>;

const meApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<Me, void>({
      query: () => "me",
    }),
    getLineBindLink: builder.query<
      { bound: boolean; key?: string; deepLink?: string | null },
      void
    >({
      query: () => "line/bind-link",
    }),
    login: builder.mutation<
      void,
      { email: string; password: string; token?: string }
    >({
      query: ({ email, password, token }) => ({
        url: "login",
        method: "POST",
        body: { email, password, token },
      }),
      invalidatesTags: TAG_TYPES,
    }),
    signup: builder.mutation<
      void,
      { name: string; email: string; password: string; token?: string }
    >({
      query: ({ name, email, password, token }) => ({
        url: "signup",
        method: "POST",
        body: { name, email, password, token },
      }),
      invalidatesTags: TAG_TYPES,
    }),
    // 409 OWNS_CLASSROOMS (with `classrooms`) while the user still owns a live
    // classroom — the account page shows which ones to hand over first.
    deleteAccount: builder.mutation<void, void>({
      query: () => ({
        url: "me",
        method: "DELETE",
      }),
    }),
    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      query: () => "notification-preferences",
      providesTags: ["Classroom"],
    }),
    updateNotificationPreference: builder.mutation<
      void,
      { type: TodoType; enabled: boolean }
    >({
      query: (body) => ({
        url: "notification-preferences",
        method: "PUT",
        body,
      }),
      // Optimistic: a switch that lags behind the tap feels broken.
      async onQueryStarted({ type, enabled }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          meApi.util.updateQueryData("getNotificationPreferences", undefined, (draft) => {
            draft[type] = enabled;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "logout",
        method: "POST",
      }),
      invalidatesTags: TAG_TYPES,
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetLineBindLinkQuery,
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useDeleteAccountMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} = meApi;
