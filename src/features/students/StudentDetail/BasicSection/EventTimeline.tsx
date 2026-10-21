import { useState } from "react";
import FilterChip from "@/components/FilterChip";
import { useGetStudentEventsQuery } from "@/store/slices/students";
import {
  EventFilter,
  buildTimelineRows,
  filterByCategory,
  groupByDay,
} from "./EventTimeline.helpers";
import EventRow from "./EventRow";
import EventSubRow from "./EventSubRow";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the loaded timeline: one day heading + a few EventRows. */
const EventTimelineSkeleton = () => (
  <div className="bg-white border border-neutral-200 rounded-2xl px-5 pt-1 pb-3" aria-hidden="true">
    <div className="pt-3.5 pb-1">
      <Skeleton className="h-4 w-24" />
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 items-start py-2.5">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex flex-col gap-1.5 pt-0.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-48 max-w-full" />
        </div>
        <Skeleton className="h-3.5 w-10" />
      </div>
    ))}
  </div>
);

const FILTERS: { label: string; value: EventFilter }[] = [
  { label: "全部", value: "all" },
  { label: "課卡", value: "card" },
  { label: "上課", value: "lesson" },
];

/** 動態分頁：全部／課卡／上課快篩，依日分段的事件列。 */
const EventTimeline = ({ studentId }: { studentId: number }) => {
  const { data: events, isLoading } = useGetStudentEventsQuery({ id: studentId });
  const [activeFilter, setActiveFilter] = useState<EventFilter>("all");

  const filtered = filterByCategory(events ?? [], activeFilter);
  const groups = groupByDay(buildTimelineRows(filtered));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((filter) => (
          <FilterChip
            key={filter.value}
            size="sm"
            active={activeFilter === filter.value}
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <EventTimelineSkeleton />
      ) : groups.length === 0 ? (
        <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
          這個分類還沒有紀錄
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-2xl px-5 pt-1 pb-3">
          {groups.map((group) => (
            <section key={group.key}>
              <h4 className="m-0 pt-3.5 pb-1 text-xs font-bold text-neutral-700 flex items-center gap-2">
                {group.dayLabel}
                {group.relative && <span className="font-medium text-neutral-500">· {group.relative}</span>}
              </h4>
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventTimeline;
