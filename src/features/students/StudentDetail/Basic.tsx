import { StudentWithDetail } from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const Basic = ({
  student,
  isPublic,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/public-students/${student.randomKey}`
    );
    toast.success("Copied to clipboard");
  };

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
          <div className="text-sm font-semibold">
            {formatDate(student.overview.lastAttendAt)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[#777777]">
          <div className="w-30">Joined at:</div>
          <div className="text-sm font-semibold">
            {formatDate(student.createdAt)}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Info
          label="Class Attend"
          value={student.overview.attendLessonCount.toString()}
        />
        <Info label="Buy Card" value={student.overview.cardCount.toString()} />
      </div>
      <div className="flex gap-3">
        <Info label="Total Spend" value={`$${student.overview.totalSpend}`} />
        <Info label="Total Saved" value={`$${student.overview.totalSaved}`} />
      </div>
      {!isPublic && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Shared URL</p>
            <p
              className="text-sm bg-primary-500 text-white rounded-lg px-2 py-2 flex gap-1"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4" />
              <span className="text-xs">Copy</span>
            </p>
          </div>
          <p className="text-sm p-2 bg-gray-100 rounded-sm">
            {window.location.origin}/public-students/{student.randomKey}
          </p>
        </div>
      )}
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
