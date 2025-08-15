import RoundCheckbox from "@/components/RoundCheckbox";
import { Student } from "@/store/slices/students";

const StudentSelectList = ({
  students,
  selectedStudents,
  setSelectedStudents,
}: {
  students: Student[];
  selectedStudents: Student[];
  setSelectedStudents: (students: Student[]) => void;
}) => {
  const handleCheckboxClick = (student: Student) => {
    if (selectedStudents.includes(student)) {
      setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {students?.map((student) => (
        <div key={student.id} className="flex items-center gap-3 cursor-pointer"
        onClick={() => handleCheckboxClick(student)}
        >
          <img
            className="w-9 h-9 rounded-full"
            src={student.avatarUrl}
            alt={student.name}
          />
          <span className="text-lg font-medium">{student.name}</span>
          <RoundCheckbox
            isChecked={selectedStudents.includes(student)}
            className="ml-auto"
          />
        </div>
      ))}
    </div>
  );
};

export default StudentSelectList;
