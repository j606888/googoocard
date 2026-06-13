import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useGetAttendanceQuery,
  useTakeAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const CheckPeriod = () => {
  const { id, periodId } = useParams();
  const [takeAttendance, { isLoading }] = useTakeAttendanceMutation();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Students may have self-checked-in via LIFF before the teacher finalizes —
  // those already have an AttendanceRecord. Pre-select them and badge the ones
  // the student checked in themselves (source = STUDENT).
  const { data: existingRecords } = useGetAttendanceQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  // Memoize so the array refs stay stable across renders — PeriodAttendanceForm
  // syncs its selection off defaultSelectedIds in an effect, and a fresh array
  // each render would re-fire that effect and wipe the teacher's manual edits.
  const defaultSelectedIds = useMemo(
    () => (existingRecords ?? []).map((r) => r.studentId),
    [existingRecords]
  );
  const selfCheckInStudentIds = useMemo(
    () =>
      (existingRecords ?? [])
        .filter((r) => r.source === "STUDENT")
        .map((r) => r.studentId),
    [existingRecords]
  );

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
        defaultSelectedIds={defaultSelectedIds}
        selfCheckInStudentIds={selfCheckInStudentIds}
        onSubmit={handleSubmit}
        submitLabel="Take Attendance"
        error={error}
        isLoading={isLoading}
      />
    </>
  );
};

export default CheckPeriod;
