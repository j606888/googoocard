import { StudentWithDetail } from "@/store/slices/students";
import { format } from "date-fns";
import EditStudent from "./EditStudent";
import StarBadge from "./StarBadge";

const ProfileCard = ({
  student,
  isPublic,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-primary-50 to-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={student.avatarUrl}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-primary-100 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-neutral-900">{student.name}</h2>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                #{student.number}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              加入於 {format(new Date(student.createdAt), "yyyy年M月")}
            </p>
            {student.note && !isPublic && (
              <p className="text-sm text-neutral-500">{student.note}</p>
            )}
          </div>
        </div>
        {!isPublic && (
          <div className="w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center shrink-0 hover:bg-neutral-50 transition-colors">
            <EditStudent student={student} />
          </div>
        )}
      </div>
      {student.danceQualifications?.length > 0 && (
        <div className="flex flex-wrap gap-2 items-start">
          {student.danceQualifications.map((type) => (
            <StarBadge key={type} type={type} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
