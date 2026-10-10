import { StudentWithDetail } from "@/store/slices/students";
import ProfileCard from "./ProfileCard";
import StatTiles from "./StatTiles";
import CopyLinkRow from "./CopyLinkRow";
import StudentLineBind from "./StudentLineBind";
import EventTimeline from "./EventTimeline";

const Basic = ({
  student,
  isPublic,
  withTimeline = true,
}: {
  student: StudentWithDetail;
  isPublic?: boolean;
  /** 分頁版面把動態拆成自己的「動態」分頁，這裡就不再重複。 */
  withTimeline?: boolean;
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
      {withTimeline && <EventTimeline studentId={student.id} />}
    </div>
  );
};

export default Basic;
