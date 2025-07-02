import { Student } from "@/store/slices/students";

const Basic = ({ student }: { student: Student }) => {
  const date = new Date(student.createdAt);
  const formatted = date.toISOString().slice(0, 10); // "2025-06-16"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 p-3 rounded-sm border-1 border-gray-200">
        <div className="flex items-center gap-3">
          <img
            src={student.avatarUrl}
            className={`w-10 h-10 rounded-full object-cover`}
          />
          <h2 className="text-xl font-semibold">{student.name}</h2>
        </div>
        <div className="flex items-center gap-3 text-[#777777]">
          <div className="w-30">Last attend:</div>
          <div className="font-semibold">-</div>
        </div>
        <div className="flex items-center gap-3 text-[#777777]">
          <div className="w-30">Joined at:</div>
          <div className="font-semibold">{formatted}</div>
        </div>
      </div>
      <div className="flex gap-3">
        <Info label="Class Attend" value="0" />
        <Info label="Buy Card" value="0" />
      </div>
      <div className="flex gap-3">
        <Info label="Total Spend" value="0" />
        <Info label="Total Saved" value="0" />
      </div>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex flex-col items-center justify-center p-3 w-full h-20 border-1 border-gray-200 rounded-sm">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-sm text-[#666666]">{label}</div>
    </div>
  );
};
export default Basic;
