"use client";

import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StudentWithDetail, useUnbindStudentLineMutation } from "@/store/slices/students";

/** 「解除 LINE 綁定？」確認框——頁首的 ⋯ 和「學生資料」的 LINE 列共用。 */
const UnbindLineDialog = ({
  student,
  open,
  onClose,
}: {
  student: Pick<StudentWithDetail, "id" | "name">;
  open: boolean;
  onClose: () => void;
}) => {
  const [unbind, { isLoading }] = useUnbindStudentLineMutation();

  const confirm = async () => {
    try {
      await unbind({ id: student.id }).unwrap();
      toast.success(`已解除 ${student.name} 的 LINE 綁定`);
    } catch {
      toast.error("解除綁定失敗，請稍後再試");
    } finally {
      onClose();
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={`解除 ${student.name} 的 LINE 綁定？`}
      message="那個 LINE 之後就看不到這位學生的課卡，也不能再用這個身分簽到；LINE 名稱和 LINE 大頭照會一起拿掉。課卡與出席紀錄都會保留，把新的綁定連結傳給本人就能重新綁定。"
      confirmLabel="解除綁定"
      variant="danger"
      isLoading={isLoading}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
};

export default UnbindLineDialog;
