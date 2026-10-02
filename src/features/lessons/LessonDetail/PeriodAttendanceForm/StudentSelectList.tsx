import { Student } from "@/store/slices/students";
import StudentOption from "./StudentOption";

const StudentSelectList = ({
  students,
  selectedStudents,
  setSelectedStudents,
  attendStudentIds,
  selfCheckInStudentIds = [],
}: {
  students: Student[];
  selectedStudents: Student[];
  setSelectedStudents: (students: Student[]) => void;
  attendStudentIds: number[];
  selfCheckInStudentIds?: number[];
}) => {
  const handleCheckboxClick = (student: Student) => {
    if (selectedStudents.includes(student)) {
      setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  // 已出席的排前面。先複製再排：students 可能是 RTK Query 回傳的凍結陣列，
  // 原地 sort 會丟 "Cannot assign to read only property"，整頁白屏。
  const sortedStudents = [...students].sort(
    (a, b) =>
      Number(attendStudentIds.includes(b.id)) - Number(attendStudentIds.includes(a.id))
  );

  return (
    <div className="flex flex-col gap-1">
      {sortedStudents?.map((student) => {
        const isAttended = attendStudentIds.includes(student.id);
        const isChecked = selectedStudents.includes(student);
        const isSelfCheckIn = selfCheckInStudentIds.includes(student.id);

        return (
          <StudentOption
            key={student.id}
            student={student}
            isAttended={isAttended}
            isChecked={isChecked}
            onClick={handleCheckboxClick}
            isFirstTime={!isAttended && isChecked}
            isSelfCheckIn={isSelfCheckIn}
          />
        );
      })}
    </div>
  );
};

export default StudentSelectList;
