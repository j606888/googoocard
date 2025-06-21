import { Pencil } from "lucide-react";

const periods = [
  {
    date: "2025/5/27, Sun",
    time: "2:00 PM ~ 2:50 PM",
  },
  {
    date: "2025/6/3, Sun",
    time: "2:00 PM ~ 2:50 PM",
  },
  {
    date: "2025/6/10, Sun",
    time: "2:00 PM ~ 2:50 PM",
  },
  {
    date: "2025/6/17, Sun",
    time: "2:00 PM ~ 2:50 PM",
  },
]

const Periods = () => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-3">
        <h3 className="text-base font-bold">Periods</h3>
        <div className="flex items-center gap-2 text-primary-700">
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-3">
        {periods.map(period => (
          <div key={`${period.date}-${period.time}`} className="flex gap-3 items-center">
            <span className="w-3 h-3 bg-primary-500 rounded-full"></span>
            <span className="text-sm font-medium">{period.date}</span>
            <span className='text-sm ml-auto'>{period.time}</span>
          </div>
        ))}

      </div>
        
    </div>
  );
};

export default Periods;
