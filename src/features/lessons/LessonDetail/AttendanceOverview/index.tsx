"use client";

import { useMemo } from "react";
import type { Lesson, LessonStudent } from "@/store/slices/lessons";
import {
  attentionItems,
  buildRosterRows,
} from "@/domains/attendance/rosterInsights";
import AttentionList from "./AttentionList";
import RosterList from "./RosterList";
import RosterTable from "./RosterTable";
import TrialRoster from "../TrialRoster";

/**
 * The lesson's attendance at a glance: how is each student tracking (roster)
 * and who needs a decision (需要注意). Per-period headcounts live in the period
 * list, so there is no chart here. Phones get a slim list with card status; desktop gets a
 * frozen-pane table with every date; 需要注意 is a filter on it.
 */
const AttendanceOverview = ({
  lesson,
  students,
  variant = "expanded",
  onViewPeriod,
  onOpenStudent,
}: {
  lesson: Lesson;
  students: LessonStudent[];
  /** `compact` = the phone 學生 tab: slimmer chart and roster. */
  variant?: "compact" | "expanded";
  /** Desktop: open a taken period's record / a student in a side sheet. */
  onViewPeriod?: (periodId: number) => void;
  onOpenStudent?: (studentId: number) => void;
}) => {
  // Memoised for the identity, not the cost: the `?? []` would otherwise hand
  // the two memos below a fresh array on every render of a lesson with no
  // periods yet, so they would recompute for nothing.
  const periods = useMemo(() => lesson.periods ?? [], [lesson.periods]);

  const items = useMemo(() => attentionItems(students), [students]);
  const rows = useMemo(
    () => buildRosterRows(students, periods),
    [students, periods]
  );

  const attentionIds = useMemo(() => new Set(items.map((item) => item.student.id)), [items]);
  const takenPeriodIds = useMemo(
    () => new Set(periods.filter((period) => period.attendanceTakenAt).map((period) => period.id)),
    [periods]
  );
  const acceptedCardNames = (lesson.cards ?? []).map((card) => card.name);

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-5">
        <TrialRoster lesson={lesson} />
        <AttentionList items={items} acceptedCardNames={acceptedCardNames} />
        <RosterList rows={rows} />
      </div>
    );
  }

  // Desktop: the roster comes first; 需要注意 moves to the bottom and lists everyone.
  return (
    <div className="flex flex-col gap-7">
      <TrialRoster lesson={lesson} />
      <RosterTable
        rows={rows}
        attentionIds={attentionIds}
        takenPeriodIds={takenPeriodIds}
        onViewPeriod={onViewPeriod}
        onOpenStudent={onOpenStudent}
      />
    </div>
  );
};

export default AttendanceOverview;
