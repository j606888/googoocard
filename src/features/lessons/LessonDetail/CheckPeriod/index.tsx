import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTakeAttendanceMutation } from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const CheckPeriod = () => {
  const { id, periodId } = useParams();
  const [takeAttendance, { isLoading }] = useTakeAttendanceMutation();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (studentIds: number[]) => {
    if (studentIds.length === 0) {
      setError("Please select at least one student");
      return;
    }

    await takeAttendance({
      id: Number(id),
      periodId: Number(periodId),
      studentIds,
    });
    router.push(`/lessons/${id}/periods/${periodId}/check-success`);
  };

  return (
    <>
      <PeriodAttendanceForm
        defaultSelectedIds={[]}
        onSubmit={handleSubmit}
        submitLabel="Take Attendance"
        error={error}
        isLoading={isLoading}
      />
    </>
  );
};

export default CheckPeriod;
