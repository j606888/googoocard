import Button from "@/components/Button";
import SubNavbar from "@/features/SubNavbar";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useParams, useRouter } from "next/navigation";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import { useEffect, useState } from "react";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import { useGetLessonQuery } from "@/store/slices/lessons";
import PeriodInfo from "./PeriodInfo";

const Step3 = () => {
  const { id, periodId } = useParams();
  const { data: students } = useGetStudentsQuery();
  const { data: lesson } = useGetLessonQuery(id as string);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const attendStudentIds = lesson?.students.map((student) => student.id) || [];
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];

    console.log(( attendStudentIds ))
  const period = lesson?.periods.find((period) => period.id === Number(periodId));

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

  if (!period) return <div>Loading...</div>;

  return (
    <>
      <SubNavbar title={"Check Period"} backUrl={`/lessons/${id}`} />
      <div className="px-5 py-5 flex flex-col gap-5">
        <div>
          <PeriodInfo period={period} />
        </div>
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
            {filteredStudents && (
              <StudentSelectList
                students={filteredStudents}
                attendStudentIds={attendStudentIds}
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
