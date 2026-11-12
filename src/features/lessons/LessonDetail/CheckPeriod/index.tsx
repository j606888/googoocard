import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useGetAttendanceQuery,
  useLazyGetAttendanceQuery,
  useGetLessonTrialsQuery,
  useTakeAttendanceMutation,
} from "@/store/slices/lessons";
import PeriodAttendanceForm from "../PeriodAttendanceForm";

const CheckPeriod = () => {
  const { id, periodId } = useParams();
  const [takeAttendance, { isLoading }] = useTakeAttendanceMutation();
  const [fetchAttendance, { isFetching: isRefetching }] = useLazyGetAttendanceQuery();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Students may have self-checked-in via LIFF before the teacher finalizes —
  // those already have an AttendanceRecord. Pre-select them and badge the ones
  // the student checked in themselves (source = STUDENT).
  const { data: existingRecords, isLoading: isRecordsLoading } = useGetAttendanceQuery({
    id: Number(id),
    periodId: Number(periodId),
  });
  // Memoize so the array refs stay stable across renders — PeriodAttendanceForm
  // syncs its selection off defaultSelectedIds in an effect, and a fresh array
  // each render would re-fire that effect and wipe the teacher's manual edits.
  // 課程頁體驗名單上已登記、還沒上過的人也預設勾好——他們上課前就報名收費了。
  const { data: trials, isLoading: isTrialsLoading } = useGetLessonTrialsQuery({ id: Number(id) });
  const trialStudentIds = useMemo(
    () =>
      (trials?.entries ?? [])
        .filter((entry) => entry.status === "registered")
        .map((entry) => entry.student.id),
    [trials]
  );
  const defaultSelectedIds = useMemo(
    () => [...new Set([...(existingRecords ?? []).map((r) => r.studentId), ...trialStudentIds])],
    [existingRecords, trialStudentIds]
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
      setError("請至少選一位學生");
      return;
    }

    const target = { id: Number(id), periodId: Number(periodId) };
    try {
      // 點名頁常開很久（開課後才送出）；這段時間有人用 LINE 自助簽到的話，
      // 他不在進頁時抓到的名單裡，老師也沒機會取消勾選他。送出前重抓一次，
      // 把進頁之後才出現的紀錄一起留著——否則 reconcileAndFinalize 會把它
      // 當成「被取消勾選」刪掉並退卡（當場買的卡卻還在）。
      const loadedIds = new Set((existingRecords ?? []).map((r) => r.studentId));
      const current = await fetchAttendance(target, false).unwrap();
      const arrivedSince = current
        .map((r) => r.studentId)
        .filter((studentId) => !loadedIds.has(studentId));
      await takeAttendance({
        ...target,
        studentIds: [...new Set([...studentIds, ...arrivedSince])],
      }).unwrap();
    } catch {
      toast.error("點名送出失敗，請再試一次");
      return;
    }
    router.push(`/lessons/${id}/periods/${periodId}/check-success?justSubmitted=1`);
  };

  return (
    <>
      <PeriodAttendanceForm
        defaultSelectedIds={defaultSelectedIds}
        selfCheckInStudentIds={selfCheckInStudentIds}
        trialStudentIds={trialStudentIds}
        onSubmit={handleSubmit}
        submitLabel="完成點名"
        error={error}
        isLoading={isLoading || isRefetching}
        isRecordsLoading={isRecordsLoading || isTrialsLoading}
      />
    </>
  );
};

export default CheckPeriod;
