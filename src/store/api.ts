import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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
]

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
