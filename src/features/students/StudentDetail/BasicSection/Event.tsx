import { Event as EventType } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { SquareDashed, Bird, Database } from "lucide-react";

const IconMap = {
  購買課卡: Database,
  簽到: Bird,
  課卡使用完畢: SquareDashed,
};

const colorMap = {
  購買課卡: "bg-[#82CDE3]",
  簽到: "bg-[#F3C559]",
  課卡使用完畢: "bg-[#848484]",
}

const Event = ({ event }: { event: EventType }) => {
  const Icon = IconMap[event.title];
  const color = colorMap[event.title];
  return (
    <div className="flex gap-4 w-full bg-[#F5F5F5] rounded-md p-3">
      <div>
        <div className={`w-10 h-10 flex-1 rounded-full ${color} text-white flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">{event.title}</p>
        <p className="text-sm text-[#333333]">{event.description}</p>
      </div>
      <div className="text-xs text-[#777777] ml-auto">
        {formatDate(event.createdAt)}
      </div>
    </div>
  );
};

export default Event;
