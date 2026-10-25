import { api } from "../api";
import type { LocationSummary } from "@/lib/locations";

/** A classroom 分部 as GET /api/locations returns it. */
export interface Location extends LocationSummary {
  address: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

export interface LocationsResponse {
  locations: Location[];
  /** 在 LINE 官方帳號公開課表與價目表. */
  lineListed: boolean;
}

// Lessons embed their location's name.
const AFFECTED_TAGS = ["Location", "Lesson"];

const locationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query<LocationsResponse, void>({
      query: () => "locations",
      providesTags: ["Location"],
    }),
    createLocation: builder.mutation<Location, { name: string; address?: string | null }>({
      query: (body) => ({ url: "locations", method: "POST", body }),
      invalidatesTags: ["Location"],
    }),
    updateLocation: builder.mutation<
      Location,
      { id: number; name?: string; address?: string | null; archived?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `locations/${id}`, method: "PATCH", body }),
      invalidatesTags: AFFECTED_TAGS,
    }),
    /** `ids` = every location of the classroom, archived included, in the new order. */
    reorderLocations: builder.mutation<Location[], number[]>({
      query: (ids) => ({ url: "locations/order", method: "PUT", body: { ids } }),
      invalidatesTags: ["Location"],
    }),
    assignLocation: builder.mutation<{ updated: number }, { locationId: number; lessonIds: number[] }>({
      query: (body) => ({ url: "locations/assign", method: "POST", body }),
      invalidatesTags: ["Lesson"],
    }),
    updateLocationSettings: builder.mutation<{ lineListed: boolean }, { lineListed: boolean }>({
      query: (body) => ({ url: "locations/settings", method: "PATCH", body }),
      invalidatesTags: ["Location"],
    }),
  }),
});

export const {
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useReorderLocationsMutation,
  useAssignLocationMutation,
  useUpdateLocationSettingsMutation,
} = locationsApi;
