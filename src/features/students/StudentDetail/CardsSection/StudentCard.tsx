import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
  useDeleteStudentCardMutation,
  useConfirmStudentCardPaymentMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import {
  ChevronDown,
  CircleDollarSign,
  EllipsisVertical,
  Hourglass,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Menu from "@/components/Menu";

const StudentCard = ({
  studentCard,
  isPublic,
}: {
  studentCard: StudentCardWithCard;
  isPublic?: boolean;
}) => {
  const [expireStudentCard] = useExpireStudentCardMutation();
  const [deleteStudentCard, { isLoading: isDeleting }] =
    useDeleteStudentCardMutation();
  const [confirmPayment, { isLoading: isConfirming }] =
    useConfirmStudentCardPaymentMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cardAction, setCardAction] = useState<"expire" | "delete" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const isUnpaid = studentCard.isPaid === false;
  const isFinished = studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const usedSessions = studentCard.attendanceRecords.length;
  // Expire keeps the (used) card but locks its remaining sessions; delete is a
  // hard remove for buy-mistakes, only safe while nothing has been consumed.
  const canExpire = !isFinished;
  const canDelete = usedSessions === 0;
  const hasActions = !isPublic && (canExpire || canDelete);
  const progress = Math.min(100, Math.round((usedSessions / studentCard.totalSessions) * 100));
  const isPractice = studentCard.card.isPracticeCard;
  const remainingTone = isFinished ? "text-neutral-400" : "text-primary-600";
  const sessionRows = useMemo(
    () =>
      Array.from({ length: studentCard.totalSessions }, (_, index) => {
        const record = studentCard.attendanceRecords[index];
        return {
          slot: index + 1,
          record,
        };
      }),
    [studentCard.attendanceRecords, studentCard.totalSessions]
  );

  const handleExpire = async () => {
    try {
      await expireStudentCard({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
      }).unwrap();
      toast.success("已停用卡片");
    } catch {
      toast.error("停用失敗");
    } finally {
      setCardAction(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteStudentCard({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
      }).unwrap();
      toast.success("已刪除卡片");
    } catch {
      toast.error("刪除失敗");
    } finally {
      setCardAction(null);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      await confirmPayment({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
      }).unwrap();
      toast.success("已確認付款");
    } catch {
      toast.error("確認付款失敗");
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <div
      key={studentCard.id}
      className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      {/* Compact summary — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-neutral-900 truncate">
              {studentCard.card.name}
            </h4>
            {isPractice && (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-warning-100 text-warning-900">
                複習卡
              </span>
            )}
            {isUnpaid && (
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-danger-100 text-danger-700">
                未付款
              </span>
            )}
          </div>
          <div className="mt-2 w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${isFinished ? "bg-neutral-300" : "bg-primary-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            購買日 {formatDate(studentCard.createdAt)}
          </p>
        </div>

        {/* Remaining sessions, emphasized */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right leading-none">
            <div className="flex items-baseline gap-0.5 justify-end">
              <span className={`text-2xl font-bold ${remainingTone}`}>
                {studentCard.remainingSessions}
              </span>
              <span className="text-sm text-neutral-400">/{studentCard.totalSessions}</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">剩餘堂數</div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center px-2 py-1 text-xs font-medium">
                  <span className="w-12 text-neutral-400">堂次</span>
                  <span className="w-24 text-neutral-500">日期</span>
                  <span className="flex-1 text-neutral-400">課程</span>
                </div>
                <div className="flex flex-col">
                  {sessionRows.map(({ slot, record }) => (
                    <div
                      key={slot}
                      className="flex items-center px-2 py-2 text-xs border-b border-neutral-100"
                    >
                      <span className="w-12 text-neutral-400">#{slot}</span>
                      <span className="w-24 font-medium text-neutral-900">
                        {record ? formatDate(record.periodStartTime) : "未使用"}
                      </span>
                      <span className="flex-1 text-neutral-700">{record?.lessonName || "未使用"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isPublic && (
                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <div className="flex flex-col gap-0.5 text-xs text-neutral-500">
                    <span>
                      {studentCard.purchaseSource === "STUDENT"
                        ? "學生自購"
                        : `由 ${studentCard.purchasedBy?.name ?? "後台"} 購買`}
                    </span>
                    {isUnpaid ? (
                      <span className="text-danger-600 font-medium">尚未付款</span>
                    ) : (
                      <span className="text-success-600">
                        已收款
                        {studentCard.paidBy?.name ? ` · ${studentCard.paidBy.name}` : ""}
                        {studentCard.paidAt ? ` · ${formatDate(studentCard.paidAt)}` : ""}
                      </span>
                    )}
                  </div>
                  {isUnpaid && (
                    <button
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-medium bg-success-600 text-white rounded-full px-3 py-1.5 cursor-pointer hover:bg-success-700 transition-colors"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <CircleDollarSign className="w-3.5 h-3.5" />
                      <span>確認付款</span>
                    </button>
                  )}
                </div>
              )}

              {hasActions && (
                <div className="flex justify-end border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    ref={menuButtonRef}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors"
                  >
                    <EllipsisVertical className="w-4 h-4" />
                    <span>更多</span>
                  </button>
                  <Menu
                    open={menuOpen}
                    anchorEl={menuButtonRef.current}
                    onClose={() => setMenuOpen(false)}
                  >
                    {canExpire && (
                      <button
                        type="button"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-sm cursor-pointer whitespace-nowrap"
                        onClick={() => {
                          setMenuOpen(false);
                          setCardAction("expire");
                        }}
                      >
                        <Hourglass className="w-4 h-4" />
                        <span>停用卡片</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 rounded-sm cursor-pointer whitespace-nowrap"
                        onClick={() => {
                          setMenuOpen(false);
                          setCardAction("delete");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>刪除卡片</span>
                      </button>
                    )}
                  </Menu>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmOpen}
        title="確認付款"
        message={`確認已收到「${studentCard.card.name}」的款項 $${studentCard.finalPrice}？`}
        confirmLabel="確認付款"
        onConfirm={handleConfirmPayment}
        onCancel={() => setConfirmOpen(false)}
        isLoading={isConfirming}
      />

      <ConfirmDialog
        open={cardAction === "expire"}
        title="停用卡片"
        message={`確定要停用「${studentCard.card.name}」嗎？停用後剩餘的 ${studentCard.remainingSessions} 堂將無法再使用。`}
        confirmLabel="停用"
        onConfirm={handleExpire}
        onCancel={() => setCardAction(null)}
      />

      <ConfirmDialog
        open={cardAction === "delete"}
        title="刪除卡片"
        message={`確定要刪除「${studentCard.card.name}」嗎？此操作無法復原，通常用於買錯卡片的情況。`}
        confirmLabel="刪除"
        onConfirm={handleDelete}
        onCancel={() => setCardAction(null)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default StudentCard;
