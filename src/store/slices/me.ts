import { api, TAG_TYPES } from "../api";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { TeacherSummary } from "./teachers";

export interface Me {
  id: number;
  name: string;
  email: string;
}

/** One period of GET /me/lessons — 我接下來的課. */
export interface MyPeriod {
  id: number;
  startTime: string;
  endTime: string;
  attendanceTakenAt: string | null;
  /** Records so far — self check-ins before attendance is taken. */
  attendanceCount: number;
  lesson: {
    id: number;
    name: string;
    level: number;
    danceStyle: DanceStyleSummary;
    location: { id: number; name: string } | null;
    teachers: TeacherSummary[];
  };
}

export interface MyLessons {
  /** The Teacher row you're linked to here; null = nothing to show. */
  teacher: TeacherSummary | null;
  periods: MyPeriod[];
}

export type TodoType = "UNPAID_CARD" | "NEEDS_RENEWAL" | "UNBOUND_ATTENDANCE";
export type NotificationPreferences = Record<TodoType, boolean>;

const meApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<Me, void>({
      query: () => "me",
    }),
    getMyLessons: builder.query<MyLessons, void>({
      query: () => "me/lessons",
      providesTags: ["Lesson", "Teacher", "Membership", "Attendance", "AttendanceRecord"],
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
    // Google／Apple 登入（也會順便註冊）。`name` 只有 Apple 第一次授權時拿得到
    oauthLogin: builder.mutation<
      void,
      { provider: "google" | "apple"; idToken: string; name?: string; code?: string; token?: string }
    >({
      query: (body) => ({ url: "auth/oauth", method: "POST", body }),
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
  useGetMyLessonsQuery,
  useGetLineBindLinkQuery,
  useLoginMutation,
  useOauthLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useDeleteAccountMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} = meApi;
