import { StudentWithDetail } from "@/store/slices/students";
import ProfileCard from "./ProfileCard";
import StatTiles from "./StatTiles";
import CopyLinkRow from "./CopyLinkRow";
import StudentLineBind from "./StudentLineBind";
import EventTimeline from "./EventTimeline";

const Basic = ({
  student,
  isPublic,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <ProfileCard student={student} isPublic={isPublic} />
      <StatTiles overview={student.overview} />
      {!isPublic && (
        <CopyLinkRow
          label="分享連結"
          caption="學生的公開頁面"
          value={`${window.location.origin}/public-students/${student.randomKey}`}
          tone="primary"
          copyButtonLabel="複製連結"
        />
      )}
      {!isPublic && <StudentLineBind studentId={student.id} />}
      <EventTimeline studentId={student.id} />
    </div>
  );
};

export default Basic;
