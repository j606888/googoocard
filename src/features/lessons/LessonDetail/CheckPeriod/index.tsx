import Button from "@/components/Button";
import SubNavbar from "@/features/SubNavbar";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useParams, useRouter } from "next/navigation";
import StudentSelectList from "./StudentSelectList";
import Searchbar from "./Searchbar";
import SelectedStudents from "./SelectedStudents";
import { useEffect, useState } from "react";
import {
  useGetLessonQuery,
  useLazyCheckStudentCardsQuery,
  useTakeAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodInfo from "./PeriodInfo";

const CheckPeriod = () => {
  const { id, periodId } = useParams();
  const { data: students } = useGetStudentsQuery();
  const { data: lesson } = useGetLessonQuery(id as string);
  const [takeAttendance, { isLoading }] = useTakeAttendanceMutation();
  const [trigger, { data: checkResult }] = useLazyCheckStudentCardsQuery();
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [filterKeyword, setFilterKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const attendStudentIds = lesson?.students.map((student) => student.id) || [];
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];
  const invalidStudentIds = checkResult?.invalidStudentIds || [];

  const period = lesson?.periods.find(
    (period) => period.id === Number(periodId)
  );

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      setError("Please select at least one student");
      return;
    }

    await takeAttendance({
      id: Number(id),
      periodId: Number(periodId),
      studentIds: selectedStudentIds,
    });
    router.push(`/lessons/${id}/periods/${periodId}/check-success`);
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
    if (selectedStudentIds.length > 0) {
      trigger({ id: Number(id), studentIds: selectedStudentIds });
    }
  }, [selectedStudentIds, trigger, id]);

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
                invalidStudentIds={invalidStudentIds}
              />
            )}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white flex gap-4 px-5 py-4">
          <Button
            onClick={handleSubmit}
            disabled={
              selectedStudents.length === 0 || invalidStudentIds.length > 0
            }
            isLoading={isLoading}
          >
            Take Attendance
          </Button>
        </div>
      </div>
    </>
  );
};

export default CheckPeriod;
