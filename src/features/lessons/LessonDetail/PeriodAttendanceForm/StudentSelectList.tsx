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

  const sortedStudents = students.sort((a) => {
    if (attendStudentIds.includes(a.id)) {
      return -1;
    }
    return 1;
  });

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
