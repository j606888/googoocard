import { useState } from "react";
import Link from "next/link";
import { Bell, FileQuestion } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetUnbindAttendanceRecordsQuery } from "@/store/slices/lessons";
import { formatDate } from "@/lib/utils";

/**
 * Attendance records charged to no card (a student marked present with nothing
 * to deduct) — not a general notification centre. Hidden when there are none.
 */
const UnpaidBell = ({
  className = "ml-auto",
  tone = "default",
}: {
  className?: string;
  /** `onPrimary`: sits on the green mobile app-bar (SubNavbar). */
  tone?: "default" | "onPrimary";
}) => {
  const [open, setOpen] = useState(false);
  const { data: unbindRecords } = useGetUnbindAttendanceRecordsQuery();

  if (!unbindRecords || unbindRecords?.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`${className} w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${
          tone === "onPrimary" ? "hover:bg-white/15" : "hover:bg-neutral-100"
        }`}
        aria-label={`${unbindRecords.length} 筆出席還沒綁課卡`}
        title={`${unbindRecords.length} 筆出席還沒綁課卡`}
      >
        <div className="flex items-center gap-2 relative">
          <Bell className={`w-6 h-6 ${tone === "onPrimary" ? "text-white" : "text-neutral-700"}`} />
          <span className="absolute -right-1 -top-1 bg-danger-500 text-white text-xs font-medium rounded-full w-4 h-4 flex items-center justify-center">
            {unbindRecords?.length}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="mr-3 mt-2">
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {unbindRecords?.map((record) => (
            <Link
              href={`/lessons/${record.lessonId}/periods/${record.lessonPeriodId}/check-success`}
              key={record.id}
             className="flex gap-3 items-center border-b border-neutral-200 pb-2 last:border-b-0 last:pb-0"
            >
                <div className="w-8 h-8 bg-neutral-500 rounded-full flex items-center justify-center">
                  <FileQuestion className="w-[16px] h-[16px] text-white" />
                </div>
                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {record.studentName}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatDate(record.lessonPeriodStartTime)}
                    </span>
                  </div>
                  <span className="text-sm text-neutral-500">
                    {record.lessonName} 未綁定課卡
                  </span>
                </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UnpaidBell;
