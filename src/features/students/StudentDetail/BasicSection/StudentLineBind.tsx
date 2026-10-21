import { useGetStudentLineBindLinkQuery } from "@/store/slices/students";
import CopyLinkRow from "./CopyLinkRow";
import { Skeleton } from "@/components/ui/skeleton";

// Teacher-facing: shows a LINE binding deep link for this student that the
// teacher copies and sends to the student. The student taps it, sends the
// pre-filled message, and the webhook binds their LINE account.
const StudentLineBind = ({ studentId }: { studentId: number }) => {
  const { data, isLoading } = useGetStudentLineBindLinkQuery({ id: studentId });

  if (isLoading) {
    // Same footprint as CopyLinkRow: icon, label, copy pill + chevron.
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 shrink-0" />
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Skeleton className="h-7 w-[88px] rounded-full" />
          <Skeleton className="w-7 h-7 rounded-full" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  if (data.bound) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-700">LINE</p>
        <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-2.5 text-sm text-success-700">
          ✓ 已綁定 LINE
        </div>
      </div>
    );
  }

  if (!data.deepLink) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-700">LINE</p>
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          LINE 綁定尚未設定完成（缺少官方帳號 ID）。
        </div>
      </div>
    );
  }

  return (
    <CopyLinkRow
      label="LINE 綁定連結"
      value={data.deepLink}
      tone="line"
      copyButtonLabel="複製連結"
    />
  );
};

export default StudentLineBind;
