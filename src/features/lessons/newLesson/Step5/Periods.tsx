import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

const Periods = () => {
  const [periods, setPeriods] = useState<{
    startTime: string;
    endTime: string;
  }[]>([]);
  const router = useRouter();
  useEffect(() => {
    const draft = JSON.parse(localStorage.getItem("lesson-draft") || "{}");
    setPeriods(draft.periods || []);
  }, []);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-3">
        <h3 className="text-base font-bold">Periods</h3>
        <div className="flex items-center gap-2 text-primary-700 cursor-pointer" onClick={() => router.push("/lessons/new/step-2")}>
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-3">
        {periods.map(period => (
          <div key={`${period.startTime}-${period.endTime}`} className="flex gap-3 items-center">
            <span className="w-3 h-3 bg-primary-500 rounded-full"></span>
            <span className="text-sm font-medium">{format(new Date(period.startTime), "MMM d")}, {format(new Date(period.startTime), "EEE")}</span>
            <span className='text-sm ml-auto'>{format(new Date(period.startTime), "hh:mm aa")} ~ {format(new Date(period.endTime), "hh:mm aa")}</span>
          </div>
        ))}

      </div>
        
    </div>
  );
};

export default Periods;
