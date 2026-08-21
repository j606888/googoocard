import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

export const TAG_TYPES = [
  "Teacher",
  "Classroom",
  "Card",
  "Student",
  "StudentCard",
  "Lesson",
  "Membership",
  "InviteToken",
  "Attendance",
  "AttendanceRecord",
  "Tag",
  "LessonGroup",
]

const rawBaseQuery = fetchBaseQuery({ baseUrl: "/api" });

// Endpoints that legitimately answer 401 (wrong password, unknown email) —
// a 401 there is a form error, not an expired session.
const AUTH_ENDPOINTS = ["login", "signup"];

// Pages reachable without a teacher session (marketing, auth, student self check-in).
const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/invitations", "/liff", "/checkin/", "/public-students"];

const isPublicPage = (pathname: string) =>
  pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

let forcingLogout = false;

/**
 * Wraps the base query so an expired/invalid session ends in an explicit
 * logout + redirect instead of a silently blank screen.
 */
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (
    result.error?.status === 401 &&
    typeof window !== "undefined" &&
    !forcingLogout &&
    !AUTH_ENDPOINTS.includes(api.endpoint) &&
    !isPublicPage(window.location.pathname)
  ) {
    forcingLogout = true;
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Clearing the cookie is best-effort; redirect either way.
    }
    // Hard navigation so the RTK Query cache is dropped along with the session.
    window.location.href = "/login";
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
