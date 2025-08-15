import { Student } from "@/store/slices/students";
import StudentOption from "./StudentOption";

const StudentSelectList = ({
  students,
  selectedStudents,
  setSelectedStudents,
  attendStudentIds,
}: {
  students: Student[];
  selectedStudents: Student[];
  setSelectedStudents: (students: Student[]) => void;
  attendStudentIds: number[];
}) => {
  const handleCheckboxClick = (student: Student) => {
    if (selectedStudents.includes(student)) {
      setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {students?.map((student) => {
        const isAttended = attendStudentIds.includes(student.id);
        const isChecked = selectedStudents.includes(student);

        return (
          <StudentOption
            key={student.id}
            student={student}
            isAttended={isAttended}
            isChecked={isChecked}
            onClick={handleCheckboxClick}
            isFirstTime={!isAttended && isChecked}
          />
        );
      })}
    </div>
  );
};

export default StudentSelectList;
