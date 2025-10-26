import { Student } from "@/store/slices/students";
import { X } from "lucide-react";

const SelectedStudents = ({
  selectedStudents,
  onRemoveStudent,
}: {
  selectedStudents: Student[];
  onRemoveStudent: (studentId: number) => void;
}) => {
  return (
    <div
      className={`transition-all duration-1000 ease-in-out flex gap-4 w-full overflow-x-auto ${
        selectedStudents.length > 0
          ? "opacity-100 max-h-96"
          : "opacity-0 max-h-0"
      }`}
    >
      {selectedStudents.map((student) => (
        <div
          key={student.id}
          className="relative flex flex-col gap-1 items-center flex-shrink-0"
          onClick={() => onRemoveStudent(student.id)}
        >
          <img
            src={student.avatarUrl}
            alt={student.name}
            className="w-9 h-9 rounded-full"
          />
          <span className="text-sm font-medium">{student.name}</span>
          <div className="absolute top-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <X className="w-3 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SelectedStudents;
