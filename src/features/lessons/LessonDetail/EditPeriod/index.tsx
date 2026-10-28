import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useGetAttendanceQuery,
  useSetPeriodAssistantsMutation,
  useUpdateAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const EditPeriod = () => {
  const { id, periodId } = useParams();
  const [updateAttendance, { isLoading }] = useUpdateAttendanceMutation();
  const [setPeriodAssistants, { isLoading: isSavingAssistants }] = useSetPeriodAssistantsMutation();
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

  const handleSubmit = async (studentIds: number[], assistantTeacherIds: number[]) => {
    if (studentIds.length === 0) {
      setError("請至少選一位學生");
      return;
    }

    await updateAttendance({
      id: Number(id),
      periodId: Number(periodId),
      studentIds,
    });
    const saved = await setPeriodAssistants({
      id: Number(id),
      periodId: Number(periodId),
      teacherIds: assistantTeacherIds,
    });
    if ("error" in saved) toast.error("助教沒存到，請到這堂的點名再存一次");
    router.push(`/lessons/${id}/periods/${periodId}/check-success?justSubmitted=1`);
  };

  return (
    <>
      <PeriodAttendanceForm
        defaultSelectedIds={defaultSelectedIds}
        onSubmit={handleSubmit}
        submitLabel="更新點名"
        error={error}
        isLoading={isLoading || isSavingAssistants}
        isRecordsLoading={isRecordsLoading}
      />
    </>
  );
};

export default EditPeriod;
