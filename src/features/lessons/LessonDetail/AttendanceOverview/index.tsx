"use client";

import { useMemo } from "react";
import type { Lesson, LessonStudent } from "@/store/slices/lessons";
import {
  attentionItems,
  buildRosterRows,
  headcountByPeriod,
} from "@/domains/attendance/rosterInsights";
import HeadcountChart from "./HeadcountChart";
import AttentionList from "./AttentionList";
import RosterList from "./RosterList";

/**
 * Replaces the old student × period dot matrix.
 *
 * The matrix answered "who showed up when" — a question a studio manager rarely
 * asks — while taking the whole centre column and saying nothing about cards.
 * These three blocks answer the questions that drive decisions instead: is the
 * class growing or shrinking, who is drifting away or out of sessions, and how
 * is each individual tracking.
 */
const AttendanceOverview = ({
  lesson,
  students,
}: {
  lesson: Lesson;
  students: LessonStudent[];
}) => {
  // Memoised for the identity, not the cost: the `?? []` would otherwise hand
  // the two memos below a fresh array on every render of a lesson with no
  // periods yet, so they would recompute for nothing.
  const periods = useMemo(() => lesson.periods ?? [], [lesson.periods]);

  const headcounts = useMemo(
    () => headcountByPeriod(students, periods),
    [students, periods]
  );
  const items = useMemo(() => attentionItems(students), [students]);
  const rows = useMemo(
    () => buildRosterRows(students, periods),
    [students, periods]
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <HeadcountChart lessonId={lesson.id} data={headcounts} />
      <AttentionList items={items} />
      <RosterList rows={rows} />
    </div>
  );
};

export default AttendanceOverview;
