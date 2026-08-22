import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { SquareDashed } from "lucide-react";

// A smaller, indented line attached under the "簽到" row that caused it —
// used only for a same-day "課卡使用完畢" event, so a single-session-card
// story (buy → check in → exhausted) doesn't take up 3 full-size rows.
const EventSubRow = ({ event }: { event: EventType }) => {
  return (
    <div className="flex items-center gap-2 pl-9 py-1 text-xs border-l border-neutral-100 ml-3">
      <SquareDashed className="w-4 h-4 text-neutral-400 shrink-0" />
      <p className="text-neutral-500 truncate">{event.description}</p>
      <span className="text-neutral-400 ml-auto shrink-0">{formatDate(event.createdAt, "HH:mm")}</span>
    </div>
  );
};

export default EventSubRow;
