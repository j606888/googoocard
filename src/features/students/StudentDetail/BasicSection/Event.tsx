import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { SquareDashed, Bird, Database, CircleDot } from "lucide-react";

const IconMap: Record<string, typeof CircleDot> = {
  購買課卡: Database,
  簽到: Bird,
  課卡使用完畢: SquareDashed,
};

const colorMap: Record<string, string> = {
  購買課卡: "bg-primary-500",
  簽到: "bg-warning-500",
  課卡使用完畢: "bg-gray-400",
}

const Event = ({ event }: { event: EventType }) => {
  // Fall back to a neutral icon/color so an unmapped title never crashes render.
  const Icon = IconMap[event.title] ?? CircleDot;
  const color = colorMap[event.title] ?? "bg-gray-400";
  return (
    <div className="flex gap-3 w-full bg-gray-50 border border-gray-100 rounded-xl p-3">
      <div>
        <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{event.title}</p>
        <p className="text-sm text-gray-600">{event.description}</p>
      </div>
      <div className="text-xs text-gray-400 ml-auto shrink-0">
        {formatDate(event.createdAt)}
      </div>
    </div>
  );
};

export default Event;
