import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  useGetAttendanceQuery,
  useUpdateAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const EditPeriod = () => {
  const { id, periodId } = useParams();
  const [updateAttendance, { isLoading }] = useUpdateAttendanceMutation();
  const { data: attendanceRecords, isLoading: isRecordsLoading } = useGetAttendanceQuery({
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
      setError("請至少選一位學生");
      return;
    }

    try {
      await updateAttendance({
        id: Number(id),
        periodId: Number(periodId),
        studentIds,
      }).unwrap();
    } catch {
      toast.error("儲存失敗，請再試一次");
      return;
    }
    router.push(`/lessons/${id}/periods/${periodId}/check-success?justSubmitted=1`);
  };

  return (
    <>
      <PeriodAttendanceForm
        defaultSelectedIds={defaultSelectedIds}
        onSubmit={handleSubmit}
        submitLabel="更新點名"
        error={error}
        isLoading={isLoading}
        isRecordsLoading={isRecordsLoading}
      />
    </>
  );
};

export default EditPeriod;
