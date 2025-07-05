import { api, TAG_TYPES } from "../api";

export interface Me {
  id: number;
  name: string;
  email: string;
}

const meApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<Me, void>({
      query: () => "me",
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
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
} = meApi;
