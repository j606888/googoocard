import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { SquareDashed } from "lucide-react";
import { presentEvent } from "./EventTimeline.helpers";

// A smaller, indented line attached under the "簽到" row that caused it —
// used only for a same-day "課卡使用完畢" event, so a single-session-card
// story (buy → check in → exhausted) doesn't take up 3 full-size rows.
const EventSubRow = ({ event }: { event: EventType }) => {
  const { title, description } = presentEvent(event);
  return (
    <div className="flex items-center gap-2 pl-11 -mt-1 pb-2 text-xs text-neutral-500">
      <SquareDashed className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <p className="m-0 truncate">
        {title}
        {description ? `：${description}` : ""}
      </p>
      <span className="ml-auto shrink-0 tabular-nums">{formatDate(event.createdAt, "HH:mm")}</span>
    </div>
  );
};

export default EventSubRow;
