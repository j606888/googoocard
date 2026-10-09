import { api } from "../api";
import type { DanceStyleColor, DanceStyleSummary } from "@/lib/danceStyles";

/** A classroom dance style as GET /api/dance-styles returns it. */
export interface DanceStyle extends DanceStyleSummary {
  sortOrder: number;
  archivedAt: string | null;
}

export interface UpdateDanceStyleArgs {
  id: number;
  name?: string;
  color?: DanceStyleColor;
  hasLevels?: boolean;
  sortOrder?: number;
  archived?: boolean;
}

// Lessons, cards and students embed their style's name/colour/hasLevels, so a
// change to a style has to refetch them too.
const AFFECTED_TAGS = ["DanceStyle", "Lesson", "Card", "Student", "StudentCard"];

const danceStylesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDanceStyles: builder.query<DanceStyle[], void>({
      query: () => "dance-styles",
      providesTags: ["DanceStyle"],
    }),
    createDanceStyle: builder.mutation<
      DanceStyle,
      { name: string; color: DanceStyleColor; hasLevels: boolean }
    >({
      query: (body) => ({ url: "dance-styles", method: "POST", body }),
      invalidatesTags: ["DanceStyle"],
    }),
    updateDanceStyle: builder.mutation<DanceStyle, UpdateDanceStyleArgs>({
      query: ({ id, ...body }) => ({ url: `dance-styles/${id}`, method: "PATCH", body }),
      invalidatesTags: AFFECTED_TAGS,
    }),
  }),
});

export const {
  useGetDanceStylesQuery,
  useCreateDanceStyleMutation,
  useUpdateDanceStyleMutation,
} = danceStylesApi;
