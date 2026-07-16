import { StudentWithDetail, useGetStudentEventsQuery } from "@/store/slices/students";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import EditStudent from "./EditStudent";
import Event from "./Event";
import StarBadge from "./StarBadge";
import StudentLineBind from "./StudentLineBind";

const Basic = ({
  student,
  isPublic,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
}) => {
  const { data: events } = useGetStudentEventsQuery({ id: student.id });
  const handleCopy = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/public-students/${student.randomKey}`
    );
    toast.success("Copied to clipboard");
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200 bg-white shadow-sm relative">
          <div className="flex items-center gap-3">
            <img
              src={student.avatarUrl}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary-100"
            />
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">{student.name}</h2>
              {student.note && !isPublic && (
                <p className="text-sm text-neutral-500">{student.note}</p>
              )}
            </div>
          </div>
          {!isPublic && (
            <div className="absolute top-4 right-4">
              <EditStudent student={student} />
            </div>
          )}
          {student.danceQualifications?.length > 0 && (
            <div className="flex flex-wrap gap-2 items-start">
              {student.danceQualifications.map((type) => (
                <StarBadge key={type} type={type} />
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Info
            label="Class Attend"
            value={student.overview.attendLessonCount.toString()}
          />
          <Info
            label="Buy Card"
            value={student.overview.cardCount.toString()}
          />
        </div>
        {!isPublic && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-700">Shared URL</p>
              <button
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary-500 text-white rounded-full px-3 py-1.5 cursor-pointer hover:bg-primary-600 transition-colors"
                onClick={handleCopy}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy link</span>
              </button>
            </div>
            <p className="text-xs text-neutral-500 break-all p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
              {window.location.origin}/public-students/{student.randomKey}
            </p>
          </div>
        )}
        {!isPublic && <StudentLineBind studentId={student.id} />}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-neutral-700">Events</h4>
          <div className="flex flex-col gap-2">
            {events?.map((event) => (
              <Event key={event.id} event={event} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-4 border border-neutral-200 rounded-2xl bg-white">
      <div className="text-2xl font-bold text-neutral-900">{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  );
};
export default Basic;
