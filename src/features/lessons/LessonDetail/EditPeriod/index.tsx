import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useGetAttendanceQuery,
  useUpdateAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const EditPeriod = () => {
  const { id, periodId } = useParams();
  const [updateAttendance, { isLoading }] = useUpdateAttendanceMutation();
  const { data: attendanceRecords } = useGetAttendanceQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  const defaultSelectedIds = useMemo(
    () => attendanceRecords?.map((record) => record.studentId) || [],
    [attendanceRecords]
  );
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (studentIds: number[]) => {
    if (studentIds.length === 0) {
      setError("Please select at least one student");
      return;
    }

    await updateAttendance({
      id: Number(id),
      periodId: Number(periodId),
      studentIds,
    });
    router.push(`/lessons/${id}/periods/${periodId}/check-success`);
  };

  return (
    <>
      <PeriodAttendanceForm
        defaultSelectedIds={defaultSelectedIds}
        onSubmit={handleSubmit}
        submitLabel="Update Period"
        error={error}
        isLoading={isLoading}
      />
    </>
  );
};

export default EditPeriod;
