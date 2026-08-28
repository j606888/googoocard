import { Button } from "@/components/ui/button";
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
  selfCheckInStudentIds?: number[];
  onSubmit: (studentIds: number[]) => Promise<void>;
  submitLabel?: string;
  error?: string | null;
  isLoading?: boolean;
};
const PeriodAttendanceForm = ({ defaultSelectedIds = [], selfCheckInStudentIds = [], onSubmit, submitLabel = "Take Attendance", error, isLoading }: PeriodAttendanceFormProps) => {
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

  if (!period) return <div>載入中…</div>;

  return (
    <>
      <SubNavbar title={"點名"} backUrl={`/lessons/${id}`} />
      <div className="px-5 pt-5 pb-40 md:pb-28 flex flex-col gap-5">
        <div>
          <PeriodInfo period={period} />
        </div>
        <div className="flex flex-col gap-4">
          <Searchbar
            error={error || null}
            onSearch={handleSearch}
            selectedStudents={selectedStudents}
            onCreateStudent={handleAddStudent}
          />
          <SelectedStudents
            selectedStudents={selectedStudents}
            onRemoveStudent={handleRemoveStudent}
            selfCheckInStudentIds={selfCheckInStudentIds}
          />
          <div className="flex flex-col gap-4 pb-4 ">
            {filteredStudents && (
              <StudentSelectList
                students={filteredStudents}
                attendStudentIds={attendStudentIds}
                selectedStudents={selectedStudents}
                selfCheckInStudentIds={selfCheckInStudentIds}
                setSelectedStudents={(students) => {
                  setSelectedStudentIds(students.map((student) => student.id));
                }}
              />
            )}
          </div>
        </div>
        {/* Lifted above the mobile BottomNav (floating pill, fixed bottom-0
            z-40) so the button stays tappable; flush to bottom on desktop where
            the nav is md:hidden. */}
        <div className="fixed left-0 right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 bg-white/90 backdrop-blur-md border-t border-neutral-100 flex gap-4 px-5 py-4 z-30">
          <Button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0}
            isLoading={isLoading}
            className="w-full rounded-xl shadow-[0_6px_18px_-6px_rgba(43,142,110,0.7)]"
          >
            {submitLabel}
            {selectedStudents.length > 0 && ` (${selectedStudents.length})`}
          </Button>
        </div>
      </div>
    </>
  );
};

export default PeriodAttendanceForm;
