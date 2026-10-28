import { api } from "../api";
import type { Module } from "@/lib/permissions";

export interface ClassroomModuleState {
  module: Module;
  enabled: boolean;
  /** 準備中：還不能開（已經開著的可以關）。 */
  locked: boolean;
  enabledAt: string | null;
  enabledBy: { id: number; name: string } | null;
}

const classroomModulesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getClassroomModules: builder.query<ClassroomModuleState[], void>({
      query: () => "classroom-modules",
      providesTags: ["ClassroomModule"],
    }),
    setClassroomModule: builder.mutation<void, { module: Module; enabled: boolean }>({
      query: ({ module, enabled }) => ({
        url: `classroom-modules/${module}`,
        method: enabled ? "PUT" : "DELETE",
      }),
      // Members' permission lists depend on which modules are on.
      invalidatesTags: ["ClassroomModule", "Access", "Membership"],
    }),
  }),
});

export const { useGetClassroomModulesQuery, useSetClassroomModuleMutation } = classroomModulesApi;
