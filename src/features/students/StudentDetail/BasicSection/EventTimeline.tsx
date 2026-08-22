import { useState } from "react";
import { useGetStudentEventsQuery } from "@/store/slices/students";
import {
  EventFilter,
  buildTimelineRows,
  filterByCategory,
  groupByDay,
} from "./EventTimeline.helpers";
import EventRow from "./EventRow";
import EventSubRow from "./EventSubRow";

const FILTERS: { label: string; value: EventFilter }[] = [
  { label: "All", value: "all" },
  { label: "Check-in", value: "checkin" },
  { label: "Card", value: "card" },
];

const EventTimeline = ({ studentId }: { studentId: number }) => {
  const { data: events } = useGetStudentEventsQuery({ id: studentId });
  const [activeFilter, setActiveFilter] = useState<EventFilter>("all");

  const filtered = filterByCategory(events ?? [], activeFilter);
  const groups = groupByDay(buildTimelineRows(filtered));

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-neutral-700">Events</h4>

      <div className="flex bg-neutral-100 p-1 rounded-xl">
        {FILTERS.map((filter) => (
          <div
            key={filter.value}
            className={`flex-1 text-center px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors rounded-lg ${
              activeFilter === filter.value
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-400">No events in this category yet.</p>
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
