"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Link2, MessageCircle, MoreHorizontal } from "lucide-react";
import Menu from "@/components/Menu";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  StudentWithDetail,
  useGetStudentLineBindLinkQuery,
  useSetStudentArchivedMutation,
} from "@/store/slices/students";
import { copyText, publicPageUrl } from "./ProfilePanels";

const itemClass =
  "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-left hover:bg-neutral-50 cursor-pointer";

/** The header's ⋯: 複製公開頁連結／複製 LINE 綁定連結／封存（或還原）學生. */
const StudentActionsMenu = ({
  student,
  buttonClassName,
}: {
  student: StudentWithDetail;
  buttonClassName: string;
}) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const { data: lineBind } = useGetStudentLineBindLinkQuery({ id: student.id });
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();
  const archived = !!student.archivedAt;
  const close = () => setAnchor(null);

  const applyArchived = async (next: boolean) => {
    try {
      await setArchived({ id: student.id, archived: next }).unwrap();
      toast.success(next ? `已封存 ${student.name}` : `已還原 ${student.name}`);
    } catch {
      toast.error("操作失敗，請稍後再試");
    } finally {
      setConfirmArchive(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="更多動作"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        className={buttonClassName}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      <Menu
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        className="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] z-50 flex flex-col py-1.5 min-w-52"
      >
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            close();
            copyText(publicPageUrl(student), "已複製公開頁連結");
          }}
        >
          <Link2 className="w-4 h-4 text-neutral-500" />
          複製公開頁連結
        </button>
        {lineBind && !lineBind.bound && lineBind.deepLink && (
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              close();
              copyText(lineBind.deepLink!, "已複製 LINE 綁定連結");
            }}
          >
            <MessageCircle className="w-4 h-4 text-neutral-500" />
            複製 LINE 綁定連結
          </button>
        )}
        <div className="h-px bg-neutral-100 my-1" />
        {archived ? (
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              close();
              applyArchived(false);
            }}
          >
            <ArchiveRestore className="w-4 h-4 text-neutral-500" />
            還原學生
          </button>
        ) : (
          <button
            type="button"
            className={`${itemClass} text-danger-700`}
            onClick={() => {
              close();
              setConfirmArchive(true);
            }}
          >
            <Archive className="w-4 h-4" />
            封存學生
          </button>
        )}
      </Menu>
      <ConfirmDialog
        open={confirmArchive}
        title={`封存 ${student.name}？`}
        message="封存後不會出現在學生名單、自助簽到和 LINE。課卡、出席與收入紀錄都會保留，之後可以從名單底部的「已封存」還原。"
        confirmLabel="封存"
        isLoading={isLoading}
        onConfirm={() => applyArchived(true)}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  );
};

export default StudentActionsMenu;
