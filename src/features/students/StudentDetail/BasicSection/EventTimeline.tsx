import { useState } from "react";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";
import { useGetStudentEventsQuery } from "@/store/slices/students";
import {
  EventFilter,
  buildTimelineRows,
  filterByCategory,
  groupByDay,
} from "./EventTimeline.helpers";
import EventRow from "./EventRow";
import EventSubRow from "./EventSubRow";

const FILTERS: SegmentedOption<EventFilter>[] = [
  { label: "全部", value: "all" },
  { label: "簽到", value: "checkin" },
  { label: "課卡", value: "card" },
];

const EventTimeline = ({ studentId }: { studentId: number }) => {
  const { data: events } = useGetStudentEventsQuery({ id: studentId });
  const [activeFilter, setActiveFilter] = useState<EventFilter>("all");

  const filtered = filterByCategory(events ?? [], activeFilter);
  const groups = groupByDay(buildTimelineRows(filtered));

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-neutral-700">動態</h4>

      <SegmentedTabs
        ariaLabel="動態分類"
        options={FILTERS}
        value={activeFilter}
        onChange={setActiveFilter}
        fill
      />

      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-400">這個分類還沒有紀錄。</p>
      )}

      <div className="flex flex-col gap-1">
        {groups.map((group) => (
          <div key={group.dayLabel} className="flex flex-col">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider pl-9 pt-2 first:pt-0">
              {group.dayLabel}
            </p>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
              {group.rows.map((row) =>
                "checkin" in row ? (
                  <div key={row.checkin.id}>
                    <EventRow event={row.checkin} />
                    <EventSubRow event={row.exhausted} />
                  </div>
                ) : (
                  <EventRow key={row.id} event={row} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventTimeline;
