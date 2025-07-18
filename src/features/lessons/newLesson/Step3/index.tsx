import Button from "@/components/Button";
import ProgressHeader from "@/components/ProgressHeader";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import CreateStudent from "./CreateStudent";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import { useEffect, useState } from "react";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import { Skeleton } from "@/components/ui/skeleton";

const Step3 = () => {
  const { data: students, isLoading: isStudentsLoading } = useGetStudentsQuery();
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];

  const handleSubmit = () => {
    if (selectedStudents.length === 0) {
      setError("Please select at least one student");
      return;
    }
    updateLessonDraft({ studentIds: selectedStudentIds });
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

  useEffect(() => {
    const draft = getLessonDraft();
    setSelectedStudentIds(draft?.studentIds || []);
  }, []);

  return (
    <>
      <ProgressHeader currentStep={3} />
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="mb-10 flex flex-col gap-4">
          <Searchbar
            error={error}
            onSearch={handleSearch}
            selectedStudents={selectedStudents}
          />
          <SelectedStudents
            selectedStudents={selectedStudents}
            onRemoveStudent={handleRemoveStudent}
          />
          <div className="flex flex-col gap-4 pb-4 ">
            <CreateStudent
              defaultName={filterKeyword}
              onCreate={(student) => {
                setSelectedStudentIds([...selectedStudentIds, student.id]);
              }}
            />
            {isStudentsLoading && (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex gap-2">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <Skeleton className="w-27 h-9 rounded-full" />
                    <Skeleton className="w-9 h-9 rounded-full ml-auto" />
                  </div>
                ))}
              </div>
            )}
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
          <Button outline onClick={() => router.push("/lessons/new/step-2")}>
            Back
          </Button>
          <Button onClick={handleSubmit}>Next</Button>
        </div>
      </div>
    </>
  );
};

export default Step3;
