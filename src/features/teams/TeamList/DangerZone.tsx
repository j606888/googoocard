import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import Drawer from "@/components/Drawer";
import {
  useDeleteClassroomMutation,
  useGetClassroomQuery,
  useGetClassroomsQuery,
  useLeaveClassroomMutation,
} from "@/store/slices/classrooms";

/**
 * The two ways out of a classroom, kept together at the bottom of the Members
 * tab and behind a confirmation each.
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

  const { data } = useGetClassroomsQuery();
  const classroom = data?.classrooms.find((c) => c.id === data.currentClassroomId);
  const isOwner = role === "owner";

  // Only the owner may read the counts, and only the delete dialog shows them.
  const { data: detail } = useGetClassroomQuery(
    { id: classroom?.id ?? 0 },
    { skip: !open || !isOwner || !classroom }
  );

  const [deleteClassroom, { isLoading: isDeleting }] = useDeleteClassroomMutation();
  const [leaveClassroom, { isLoading: isLeaving }] = useLeaveClassroomMutation();

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
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <div className="mt-8 rounded-xl border border-danger-200 bg-danger-50 p-4">
        <div className="flex items-center gap-2 text-danger-700">
          <AlertTriangle className="h-4 w-4" />
          <h3 className="font-semibold">Danger zone</h3>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          {isOwner
            ? "Deleting archives the classroom for everyone. It disappears from every member's classroom list and the check-in QR board stops working."
            : `You'll lose access to ${classroom.name}. The owner can invite you back later.`}
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full cursor-pointer rounded-lg border border-danger-500 py-2 font-semibold text-danger-600 hover:bg-danger-100"
        >
          {isOwner ? "Delete classroom" : "Leave classroom"}
        </button>
      </div>

      <Drawer
        title={isOwner ? "Delete classroom" : "Leave classroom"}
        open={open}
        onClose={close}
        onSubmit={handleSubmit}
        isLoading={isDeleting || isLeaving}
        variant="danger"
        submitText={isOwner ? "DELETE" : "LEAVE"}
        // Typing the name is the whole guardrail for an action that takes the
        // classroom away from every member at once.
        disabled={isOwner && confirmName.trim() !== classroom.name}
      >
        {isOwner ? (
          <>
            <p className="mb-3 text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">{classroom.name}</span> will be
              archived along with everything in it:
            </p>
            <ul className="mb-4 space-y-1 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700">
              <li>{detail?.counts.students ?? "—"} students</li>
              <li>{detail?.counts.lessons ?? "—"} lessons</li>
              <li>{detail?.counts.studentCards ?? "—"} student cards</li>
            </ul>
            <label className="mb-2 block text-sm font-medium">
              Type <span className="font-semibold">{classroom.name}</span> to confirm
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
            You will be removed from{" "}
            <span className="font-semibold text-neutral-900">{classroom.name}</span> and lose
            access to its students, lessons and revenue.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      </Drawer>
    </>
  );
};

export default DangerZone;
