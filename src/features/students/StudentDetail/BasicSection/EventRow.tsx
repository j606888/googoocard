import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { CircleDot } from "lucide-react";
import { IconMap, colorMap } from "./EventTimeline.helpers";

// One line per event: icon + description only (the icon's color already
// encodes the type, so a separate bold title line is redundant) + time.
const EventRow = ({ event }: { event: EventType }) => {
  const Icon = IconMap[event.title] ?? CircleDot;
  const color = colorMap[event.title] ?? "bg-neutral-400";
  return (
    <div className="relative z-10 flex items-center gap-3 py-2">
      <div className={`w-6 h-6 rounded-full ${color} text-white flex items-center justify-center shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="flex-1 min-w-0 text-sm text-neutral-700 truncate">{event.description}</p>
      <span className="text-xs text-neutral-400 shrink-0">{formatDate(event.createdAt, "HH:mm")}</span>
    </div>
  );
};

export default EventRow;
