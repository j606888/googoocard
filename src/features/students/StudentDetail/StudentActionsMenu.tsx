"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Link2, MessageCircle, MoreHorizontal } from "lucide-react";
import Menu from "@/components/Menu";
import ArchiveStudentDialog from "./ArchiveStudentDialog";
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
  const [setArchived] = useSetStudentArchivedMutation();
  const archived = !!student.archivedAt;
  const close = () => setAnchor(null);

  const restore = async () => {
    try {
      await setArchived({ id: student.id, archived: false }).unwrap();
      toast.success(`已還原 ${student.name}`);
    } catch {
      toast.error("還原失敗，請稍後再試");
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
              restore();
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
      <ArchiveStudentDialog
        student={student}
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
      />
    </>
  );
};

export default StudentActionsMenu;
