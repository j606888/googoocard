import { api } from "../api";

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
  }),
});

export const { useGetMeQuery } = meApi;