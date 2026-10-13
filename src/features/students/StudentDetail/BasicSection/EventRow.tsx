import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { presentEvent } from "./EventTimeline.helpers";

/** 一筆動態：圓形圖示、標題、說明、時間。 */
const EventRow = ({ event }: { event: EventType }) => {
  const { icon: Icon, tone, title, description } = presentEvent(event);
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 items-start py-2.5">
      <span className={`w-8 h-8 rounded-full grid place-items-center ${tone}`} aria-hidden="true">
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        {description && <span className="block text-[13px] text-neutral-600 mt-0.5">{description}</span>}
      </span>
      <time className="text-xs text-neutral-500 whitespace-nowrap pt-0.5 tabular-nums">
        {formatDate(event.createdAt, "HH:mm")}
      </time>
    </div>
  );
};

export default EventRow;
