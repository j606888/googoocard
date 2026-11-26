import { api } from '../api';
import type { DanceStyleSummary } from '@/lib/danceStyles';
import type { LocationSummary } from '@/lib/locations';
import type { MonthSummary, PeriodState } from '@/lib/teacherStats';
import type { LessonKind } from '@/lib/lessonKind';
import type { TeacherColor, TeacherKind } from '@/lib/teachers';

/** What lessons embed about their teachers. */
export interface TeacherSummary {
  id: number;
  name: string;
  color: string;
}

/** The teacher's own fields, as every teacher endpoint returns them. */
export interface TeacherProfile extends TeacherSummary {
  /** 這位老師上課的分部（純標示）。 */
  locations: LocationSummary[];
  note: string | null;
  /** 老師／助教／都是：只當助教的排課時不列出，只教課的選助教時不列出。 */
  kind: TeacherKind;
  archivedAt: string | null;
}

export interface Teacher extends TeacherProfile {
  /** The member this teacher is linked to (團隊), or null. */
  userId: number | null;
  archivedAt: string | null;
  activeLessonCount: number;
  lessonCount: number;
}

/** One row of GET /teachers/overview. */
export interface TeacherOverviewRow extends TeacherProfile {
  /** 連到的帳號（團隊成員），沒帳號是 null。 */
  userId: number | null;
  lessonCount: number;
  /** In-progress lessons this teacher teaches. */
  activeLessons: OverviewLesson[];
  /** In-progress lessons this person assists (課程小幫手) — never counted as teaching. */
  assistedLessons: OverviewLesson[];
  /** The period under way (`ongoing`) or the next one; null when nothing is scheduled. */
  nextPeriod: {
    startTime: string;
    endTime: string;
    lessonId: number;
    lessonName: string;
    ongoing: boolean;
  } | null;
}

/** One lesson on a list row. */
export interface OverviewLesson {
  id: number;
  name: string;
  status: string;
  danceStyle: DanceStyleSummary;
  location: LocationSummary | null;
  /** The lesson's current slot (for「週四 20:30」): its next period, else its latest one. */
  slotStart: string | null;
}

export interface TeachersOverview {
  /** In-progress lessons with no teacher. */
  unassignedLessonCount: number;
  teachers: TeacherOverviewRow[];
}

export interface TeacherLessonRow {
  id: number;
  name: string;
  status: string;
  kind: LessonKind;
  level: number;
  danceStyle: DanceStyleSummary;
  location: LocationSummary | null;
  totalPeriods: number;
  taughtCount: number;
  avgAttendance: number | null;
  firstStart: string | null;
  lastStart: string | null;
  nextStart: string | null;
}

export interface TeacherDetail {
  teacher: TeacherProfile & { userId: number | null };
  month: string;
  danceStyles: DanceStyleSummary[];
  firstTaughtAt: string | null;
  stats: MonthSummary;
  previousMonthAttendance: number;
  trend: { month: string; sessions: number; attendance: number }[];
  lessons: TeacherLessonRow[];
  /** Every lesson this person assists, any status, same shape — not part of `stats`／`trend`. */
  assistedLessons: TeacherLessonRow[];
  periods: {
    id: number;
    startTime: string;
    endTime: string;
    lessonId: number;
    lessonName: string;
    state: PeriodState;
    attendance: number;
  }[];
  regulars: { id: number; name: string; avatarUrl: string; count: number }[];
}

export interface TeacherFields {
  name?: string;
  color?: TeacherColor;
  /** Replaces the whole list. */
  locationIds?: number[];
  /** Blank clears it. */
  note?: string;
  kind?: TeacherKind;
}

// A teacher's name and colour show up inside lessons too.
// Membership: the team page shows each member's person (name, colour, 身分).
const AFFECTED_TAGS = ['Teacher', 'Lesson', 'Membership'] as const;

const teachersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeachers: builder.query<Teacher[], void>({
      query: () => 'teachers',
      providesTags: ['Teacher'],
    }),
    getTeachersOverview: builder.query<TeachersOverview, void>({
      query: () => 'teachers/overview',
      providesTags: ['Teacher'],
    }),
    getTeacher: builder.query<TeacherDetail, { id: number; month: string }>({
      query: ({ id, month }) => `teachers/${id}?month=${month}`,
      providesTags: ['Teacher'],
    }),
    createTeacher: builder.mutation<TeacherSummary, TeacherFields & { name: string }>({
      query: (body) => ({ url: 'teachers', method: 'POST', body }),
      invalidatesTags: ['Teacher'],
    }),
    updateTeacher: builder.mutation<
      TeacherSummary,
      TeacherFields & { id: number; archived?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `teachers/${id}`, method: 'PATCH', body }),
      invalidatesTags: [...AFFECTED_TAGS],
    }),
    deleteTeacher: builder.mutation<TeacherSummary, { id: number }>({
      query: ({ id }) => ({ url: `teachers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Teacher'],
    }),
  }),
});

export const {
  useGetTeachersQuery,
  useGetTeachersOverviewQuery,
  useGetTeacherQuery,
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
} = teachersApi;
