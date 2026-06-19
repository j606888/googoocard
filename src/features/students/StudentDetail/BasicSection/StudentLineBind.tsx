import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useGetStudentLineBindLinkQuery } from "@/store/slices/students";

// Teacher-facing: shows a LINE binding deep link for this student that the
// teacher copies and sends to the student. The student taps it, sends the
// pre-filled message, and the webhook binds their LINE account.
const StudentLineBind = ({ studentId }: { studentId: number }) => {
  const { data, isLoading } = useGetStudentLineBindLinkQuery({ id: studentId });

  if (isLoading || !data) return null;

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

  const handleCopy = () => {
    navigator.clipboard.writeText(data.deepLink!);
    toast.success("已複製學生綁定連結");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-700">LINE 綁定連結</p>
        <button
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#06C755] text-white rounded-full px-3 py-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleCopy}
        >
          <Copy className="w-3.5 h-3.5" />
          <span>複製連結</span>
        </button>
      </div>
      <p className="text-xs text-neutral-500 break-all p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
        {data.deepLink}
      </p>
    </div>
  );
};

export default StudentLineBind;
