import { StudentWithDetail } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";

const Basic = ({ student }: { student: StudentWithDetail }) => {

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
          <div className="text-sm font-semibold">{formatDate(student.overview.lastAttendAt)}</div>
        </div>
        <div className="flex items-center gap-3 text-[#777777]">
          <div className="w-30">Joined at:</div>
          <div className="text-sm font-semibold">{formatDate(student.createdAt)}</div>
        </div>
      </div>
      <div className="flex gap-3">
        <Info label="Class Attend" value={student.overview.attendLessonCount.toString()} />
        <Info label="Buy Card" value={student.overview.cardCount.toString()} />
      </div>
      <div className="flex gap-3">
        <Info label="Total Spend" value={`$${student.overview.totalSpend}`} />
        <Info label="Total Saved" value={`$${student.overview.totalSaved}`} />
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
