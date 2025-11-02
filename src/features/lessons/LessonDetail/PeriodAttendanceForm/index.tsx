import Button from "@/components/Button";
import SubNavbar from "@/features/SubNavbar";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useParams } from "next/navigation";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import { useEffect, useState } from "react";
import { useGetLessonQuery } from "@/store/slices/lessons";
import PeriodInfo from "./PeriodInfo";

type PeriodAttendanceFormProps = {
  defaultSelectedIds?: number[];
  onSubmit: (studentIds: number[]) => Promise<void>;
  submitLabel?: string;
  error?: string | null;
  isLoading?: boolean;
};
const PeriodAttendanceForm = ({ defaultSelectedIds = [], onSubmit, submitLabel = "Take Attendance", error, isLoading }: PeriodAttendanceFormProps) => {
  const { id, periodId } = useParams();
  const { data: students } = useGetStudentsQuery();
  const { data: lesson } = useGetLessonQuery(id as string);
  const [selectedStudentIds, setSelectedStudentIds] =
    useState<number[]>(defaultSelectedIds);
  const [filterKeyword, setFilterKeyword] = useState("");
  const attendStudentIds = lesson?.students.map((student) => student.id) || [];
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];

  const period = lesson?.periods.find(
    (period) => period.id === Number(periodId)
  );

  useEffect(() => {
    if (defaultSelectedIds && defaultSelectedIds.length > 0) {
      setSelectedStudentIds(defaultSelectedIds);
    }
  }, [defaultSelectedIds]);

  const handleSubmit = async () => {
    await onSubmit(selectedStudentIds);
    // if (selectedStudents.length === 0) {
    //   setError("Please select at least one student");
    //   return;
    // }

    // await takeAttendance({
    //   id: Number(id),
    //   periodId: Number(periodId),
    //   studentIds: selectedStudentIds,
    // });
    // router.push(`/lessons/${id}/periods/${periodId}/check-success`);
  };

  const handleSearch = (search: string) => {
    setFilterKeyword(search);
  };

  const handleRemoveStudent = (studentId: number) => {
    setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
  };

  const handleAddStudent = (studentId: number) => {
    setSelectedStudentIds([...selectedStudentIds, studentId]);
  };

  const filteredStudents =
    students?.filter(
      (student) =>
        filterKeyword === "" ||
        student.name.toLowerCase().includes(filterKeyword.toLowerCase())
    ) || [];

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
            error={error || null}
            onSearch={handleSearch}
            selectedStudents={selectedStudents}
            onCreateStudent={handleAddStudent}
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
          <Button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0}
            isLoading={isLoading}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
};

export default PeriodAttendanceForm;
