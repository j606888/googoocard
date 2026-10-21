import { api } from '../api';
import type { DanceStyleColor, DanceStyleSummary } from '@/lib/danceStyles';
import type { MonthSummary, PeriodState } from '@/lib/teacherStats';
import type { LessonKind } from '@/lib/lessonKind';

/** What lessons embed about their teachers. */
export interface TeacherSummary {
  id: number;
  name: string;
  color: string;
}

export interface Teacher extends TeacherSummary {
  note: string | null;
  archivedAt: string | null;
  activeLessonCount: number;
  lessonCount: number;
}

/** One row of GET /teachers/overview. */
export interface TeacherOverviewRow extends TeacherSummary {
  note: string | null;
  archivedAt: string | null;
  lessonCount: number;
  activeLessonCount: number;
  danceStyles: DanceStyleSummary[];
  stats: MonthSummary;
  /** Sessions taught per month, oldest first — lines up with `months`. */
  trend: number[];
  nextPeriod: { startTime: string; lessonId: number; lessonName: string } | null;
}

export interface TeachersOverview {
  month: string;
  months: string[];
  /** Classroom-wide for the month — a co-taught period counts once. */
  totals: MonthSummary;
  /** In-progress lessons with no teacher — they count for nobody. */
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
  totalPeriods: number;
  taughtCount: number;
  avgAttendance: number | null;
  firstStart: string | null;
  lastStart: string | null;
  nextStart: string | null;
}

export interface TeacherDetail {
  teacher: TeacherSummary & { note: string | null; archivedAt: string | null };
  month: string;
  danceStyles: DanceStyleSummary[];
  firstTaughtAt: string | null;
  stats: MonthSummary;
  previousMonthAttendance: number;
  trend: { month: string; sessions: number; attendance: number }[];
  lessons: TeacherLessonRow[];
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
  color?: DanceStyleColor;
  /** Blank clears it. */
  note?: string;
}

// A teacher's name and colour show up inside lessons too.
const AFFECTED_TAGS = ['Teacher', 'Lesson'] as const;

const teachersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeachers: builder.query<Teacher[], void>({
      query: () => 'teachers',
      providesTags: ['Teacher'],
    }),
    getTeachersOverview: builder.query<TeachersOverview, { month: string }>({
      query: ({ month }) => `teachers/overview?month=${month}`,
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
