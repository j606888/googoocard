import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const UnpaidBell = () => {
  const [open, setOpen] = useState(false);

  return (<Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger className="ml-auto">
      <div className="mr-1 flex items-center gap-2 ml-auto relative">
        <Bell className="w-6 h-6 text-white" />
        <span className="absolute -right-1 -top-1 bg-red-500 text-white text-xs font-medium rounded-full w-4 h-4 flex items-center justify-center">
          0
        </span>
      </div>
    </PopoverTrigger>
    <PopoverContent className="mr-3 mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-medium w-full text-center mb-4  pb-2">
          Unpaid Cards
        </h4>
      </div>
      <div className="flex flex-col gap-2">
        
      </div>
    </PopoverContent>
  </Popover>)
};

export default UnpaidBell;