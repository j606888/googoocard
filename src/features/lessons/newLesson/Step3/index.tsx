import Button from "@/components/Button";
import ProgressBall from "@/components/ProgressBall";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import CreateStudent from "./CreateStudent";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import { useState } from "react";

const Step3 = () => {
  const { data: students } = useGetStudentsQuery();
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const router = useRouter();
  const [filterKeyword, setFilterKeyword] = useState("");
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];

  const handleSubmit = () => {
    router.push("/lessons/new/step-4");
  };

  const handleSearch = (search: string) => {
    setFilterKeyword(search);
  };

  const handleRemoveStudent = (studentId: number) => {
    setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
  };

  const filteredStudents =
    students?.filter(
      (student) =>
        filterKeyword === "" ||
        student.name.toLowerCase().includes(filterKeyword.toLowerCase())
    ) || [];

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-center">Attend students</h2>
      <ProgressBall currentStep={3} />
      <div className="border-t-1 border-gray-200 mt-2 pt-3 mb-10 flex flex-col gap-4">
        <Searchbar
          onSearch={handleSearch}
          selectedStudents={selectedStudents}
        />
        {selectedStudents.length > 0 && (
          <SelectedStudents
            selectedStudents={selectedStudents}
            onRemoveStudent={handleRemoveStudent}
          />
        )}
        <div className="flex flex-col gap-4  max-h-[calc(100vh-522px)] overflow-y-auto">
          <CreateStudent
            defaultName={filterKeyword}
            onCreate={(student) => {
              setSelectedStudentIds([...selectedStudentIds, student.id]);
            }}
          />
          {filteredStudents && (
            <StudentSelectList
              students={filteredStudents}
              selectedStudents={selectedStudents}
              setSelectedStudents={(students) => {
                setSelectedStudentIds(students.map((student) => student.id));
              }}
            />
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white flex gap-4 px-5 py-4">
        <Button outline onClick={() => router.back()}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Next</Button>
      </div>
    </div>
  );
};

export default Step3;
