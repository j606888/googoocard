import { api } from "../api";

/** GET me/access — what the signed-in member may do in the current classroom. */
export interface Access {
  role: string;
  /** src/lib/permissions.ts PERMISSIONS keys. */
  permissions: string[];
  /** Modules switched on in this classroom. */
  modules: string[];
}

const accessApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAccess: builder.query<Access, void>({
      query: () => "me/access",
      // A role change, a module switch or a classroom switch all change it.
      providesTags: ["Access", "Membership", "ClassroomModule"],
    }),
  }),
});

export const { useGetAccessQuery } = accessApi;
