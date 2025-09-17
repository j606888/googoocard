import { useState } from "react";
import Link from "next/link";
import { Bell, FileQuestion } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetUnbindAttendanceRecordsQuery } from "@/store/slices/lessons";

const UnpaidBell = () => {
  const [open, setOpen] = useState(false);
  const { data: unbindRecords } = useGetUnbindAttendanceRecordsQuery();

  if (unbindRecords?.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="ml-auto">
        <div className="mr-1 flex items-center gap-2 ml-auto relative">
          <Bell className="w-6 h-6 text-white" />
          <span className="absolute -right-1 -top-1 bg-red-500 text-white text-xs font-medium rounded-full w-4 h-4 flex items-center justify-center">
            {unbindRecords?.length}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="mr-3 mt-2">
        {/* <div className="flex items-center justify-between">
        <h4 className="text-base font-medium w-full text-center mb-4  pb-2">
          
        </h4>
      </div> */}
        <div className="flex flex-col gap-2">
          {unbindRecords?.map((record) => (
            <Link
              href={`/lessons/${record.lessonId}/periods/${record.lessonPeriodId}/check-success`}
              key={record.studentId}
            >
              <div className="flex gap-3 items-center border-b border-gray-300 pb-2 last:border-b-0 last:pb-0">
                <div className="w-8 h-8 bg-[#848484] rounded-full flex items-center justify-center">
                  <FileQuestion className="w-[16px] h-[16px] text-white" />
                </div>
                <div className="flex flex-col ">
                  <span className="text-sm font-semibold">
                    {record.studentName}
                  </span>
                  <span className="text-sm text-[#848484]">
                    {record.lessonName} 未綁定課卡
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UnpaidBell;
