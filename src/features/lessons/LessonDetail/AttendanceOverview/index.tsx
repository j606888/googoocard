"use client";

import { useMemo } from "react";
import type { Lesson, LessonStudent } from "@/store/slices/lessons";
import {
  attentionItems,
  buildRosterRows,
  headcountByPeriod,
  lessonAttendanceRate,
} from "@/domains/attendance/rosterInsights";
import HeadcountChart from "./HeadcountChart";
import AttentionList from "./AttentionList";
import RosterList from "./RosterList";
import RosterTable from "./RosterTable";
import TrialRoster from "../TrialRoster";

/**
 * The lesson's attendance at a glance: is the class growing or shrinking
 * (chart), how is each student tracking (roster), and who needs a decision
 * (需要注意). Phones get a slim list with card status; desktop gets a
 * frozen-pane table with every date and lists 需要注意 last.
 */
const AttendanceOverview = ({
  lesson,
  students,
  variant = "expanded",
}: {
  lesson: Lesson;
  students: LessonStudent[];
  /** `compact` = the phone 學生 tab: slimmer chart and roster. */
  variant?: "compact" | "expanded";
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

  const attentionIds = useMemo(() => new Set(items.map((item) => item.student.id)), [items]);
  const acceptedCardNames = (lesson.cards ?? []).map((card) => card.name);

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-5">
        <TrialRoster lesson={lesson} />
        <HeadcountChart lessonId={lesson.id} data={headcounts} variant="compact" />
        <AttentionList items={items} acceptedCardNames={acceptedCardNames} />
        <RosterList rows={rows} />
      </div>
    );
  }

  // Desktop: the roster comes first; 需要注意 moves to the bottom and lists everyone.
  return (
    <div className="flex flex-col gap-7">
      <TrialRoster lesson={lesson} />
      <HeadcountChart
        lessonId={lesson.id}
        data={headcounts}
        attendanceRate={lessonAttendanceRate(students).rate}
      />
      <RosterTable rows={rows} attentionIds={attentionIds} />
      <AttentionList items={items} acceptedCardNames={acceptedCardNames} variant="expanded" />
    </div>
  );
};

export default AttendanceOverview;
