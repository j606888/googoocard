import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/Drawer";
import {
  useDeleteClassroomMutation,
  useGetClassroomQuery,
  useGetClassroomsQuery,
  useLeaveClassroomMutation,
} from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The two ways out of a classroom, kept together at the bottom of the team page
 * and behind a confirmation each.
 *
 * Which one you get is decided by role: an assistant leaves, an owner deletes.
 * An owner can't leave — the classroom would be left without one — so they see
 * only the delete action.
 */
const DangerZone = ({ role }: { role: string }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading: isClassroomsLoading } = useGetClassroomsQuery();
  const classroom = data?.classrooms.find((c) => c.id === data.currentClassroomId);
  const isOwner = role === "owner";

  // Only the owner may read the counts, and only the delete dialog shows them.
  const { data: detail } = useGetClassroomQuery(
    { id: classroom?.id ?? 0 },
    { skip: !open || !isOwner || !classroom }
  );

  const [deleteClassroom, { isLoading: isDeleting }] = useDeleteClassroomMutation();
  const [leaveClassroom, { isLoading: isLeaving }] = useLeaveClassroomMutation();

  if (isClassroomsLoading) {
    return <Skeleton className="mt-4 h-[110px] w-full rounded-2xl lg:mt-6" />;
  }
  if (!classroom) return null;

  const close = () => {
    setOpen(false);
    setConfirmName("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    try {
      const { nextClassroomId } = isOwner
        ? await deleteClassroom({ id: classroom.id }).unwrap()
        : await leaveClassroom({ id: classroom.id }).unwrap();

      close();
      // The server already re-issued the auth cookie for whichever classroom is
      // next; with none left the user has to create one before anything works.
      router.push(nextClassroomId ? "/lessons" : "/onboarding");
    } catch {
      setError("發生錯誤，請再試一次");
    }
  };

  return (
    <>
      <section className="mt-4 flex flex-col gap-2 lg:mt-6">
        <h3 className="mx-1 text-[13px] font-medium text-danger-700 lg:mx-0">危險操作</h3>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger-200 bg-white p-3.5 lg:gap-4 lg:px-5 lg:py-4">
          <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-0.5">
            <span className="font-medium">{isOwner ? "刪除教室" : "退出教室"}</span>
            <span className="text-[13px] leading-relaxed text-neutral-500">
              {isOwner
                ? "整間教室會被封存：所有成員都看不到它，牆上的簽到 QR 也會失效。"
                : `你將失去 ${classroom.name} 的存取權，之後可以請擁有者再邀請你回來。`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 shrink-0 cursor-pointer rounded-lg border border-danger-400 bg-white px-4 text-sm font-medium text-danger-700 hover:bg-danger-50 lg:h-10"
          >
            {isOwner ? "刪除教室…" : "退出…"}
          </button>
        </div>
      </section>

      <Drawer
        title={isOwner ? "刪除教室" : "退出教室"}
        open={open}
        onClose={close}
        onSubmit={handleSubmit}
        isLoading={isDeleting || isLeaving}
        variant="danger"
        submitText={isOwner ? "刪除" : "退出"}
        // Typing the name is the whole guardrail for an action that takes the
        // classroom away from every member at once.
        disabled={isOwner && confirmName.trim() !== classroom.name}
      >
        {isOwner ? (
          <>
            <p className="mb-3 text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">{classroom.name}</span>{" "}
              以及裡面的所有資料都會被封存：
            </p>
            <ul className="mb-4 space-y-1 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700">
              <li>{detail?.counts.students ?? "—"} 位學生</li>
              <li>{detail?.counts.lessons ?? "—"} 堂課程</li>
              <li>{detail?.counts.studentCards ?? "—"} 張學生課卡</li>
            </ul>
            <label className="mb-2 block text-sm font-medium">
              請輸入 <span className="font-semibold">{classroom.name}</span> 以確認
            </label>
            <input
              className="mb-2 w-full rounded bg-neutral-100 p-2"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={classroom.name}
            />
          </>
        ) : (
          <p className="text-sm text-neutral-600">
            你將被移出{" "}
            <span className="font-semibold text-neutral-900">{classroom.name}</span>
            ，並失去其中學生、課程與收入資料的存取權。
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      </Drawer>
    </>
  );
};

export default DangerZone;
