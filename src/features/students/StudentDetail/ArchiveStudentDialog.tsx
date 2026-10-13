"use client";

import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StudentWithDetail, useSetStudentArchivedMutation } from "@/store/slices/students";

/** 「封存學生？」確認框——頁首的 ⋯ 和編輯表單共用。 */
const ArchiveStudentDialog = ({
  student,
  open,
  onClose,
  onArchived,
}: {
  student: Pick<StudentWithDetail, "id" | "name">;
  open: boolean;
  onClose: () => void;
  onArchived?: () => void;
}) => {
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();

  const archive = async () => {
    try {
      await setArchived({ id: student.id, archived: true }).unwrap();
      toast.success(`已封存 ${student.name}`);
      onArchived?.();
    } catch {
      toast.error("封存失敗，請稍後再試");
    } finally {
      onClose();
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={`封存 ${student.name}？`}
      message="封存後不會出現在學生名單、自助簽到和 LINE。課卡、出席與收入紀錄都會保留，之後可以從名單底部的「已封存」還原。"
      confirmLabel="封存"
      isLoading={isLoading}
      onConfirm={archive}
      onCancel={onClose}
    />
  );
};

export default ArchiveStudentDialog;
