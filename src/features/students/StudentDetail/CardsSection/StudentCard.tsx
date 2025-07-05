import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
  useMarkStudentCardAsPaidMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { EllipsisVertical, Rat, CircleDollarSign } from "lucide-react";
import { MdWarning } from "react-icons/md";
import Menu from "@/components/Menu";
import { useRef, useState } from "react";
import { toast } from "sonner";

const StudentCard = ({ studentCard }: { studentCard: StudentCardWithCard }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasDiscount = studentCard.basePrice !== studentCard.finalPrice;
  const disabled =
    studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [expireStudentCard] = useExpireStudentCardMutation();
  const [markStudentCardAsPaid] = useMarkStudentCardAsPaidMutation();

  const handleExpire = async () => {
    const confirm = window.confirm("Are you sure you want to expire this card?");
    if (!confirm) return;

    await expireStudentCard({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    setMenuOpen(false);
    toast.success("Card expired");
  };

  const handlePay = async () => {
    const confirm = window.confirm("Are you sure you want to mark this card as paid?");
    if (!confirm) return;

    await markStudentCardAsPaid({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    setMenuOpen(false);
    toast.success("Card marked as paid");
  }

  return (
    <div
      key={studentCard.id}
      className={`relative flex flex-col gap-2 p-3 rounded-sm shadow-sm ${
        !studentCard.paid
          ? "bg-warning-100"
          : disabled
          ? "bg-[#F4F4F4]"
          : "bg-primary-50"
      }`}
    >
      {!studentCard.paid && (
        <div className="text-sm text-warning-500 font-medium flex items-center gap-1">
          <MdWarning className="w-4 h-4" />
          <span>Not Paid yet</span>
        </div>
      )}
      <div className="flex border-b-1 border-b-gray-200 pb-2">
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-sm font-medium">{studentCard.card.name}</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm text-gray-500 font-medium ${
                hasDiscount ? "line-through" : ""
              }`}
            >
              ${studentCard.basePrice}
            </span>
            {hasDiscount && (
              <span className="text-sm text-primary-500 font-medium">
                ${studentCard.finalPrice}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-sm font-medium">{`${studentCard.remainingSessions}/${studentCard.totalSessions}`}</span>
          <span className="text-sm text-gray-500">sessions</span>
        </div>
      </div>
      <div className="flex">
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-sm text-gray-500">Purchased at</span>
          <span className="text-sm font-medium">
            {formatDate(studentCard.createdAt)}
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-sm text-gray-500">Expired at</span>
          <span className="text-sm font-medium">
            {studentCard.expiredAt ? formatDate(studentCard.expiredAt) : "-"}
          </span>
        </div>
      </div>
      {!disabled && (
        <button
          className="absolute top-4 right-4"
          ref={buttonRef}
          onClick={() => setMenuOpen(true)}
        >
          <EllipsisVertical className="w-4 h-4" />
        </button>
      )}
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <div className="flex flex-col py-3 gap-2">
          {!studentCard.paid && (
            <button
              className="flex gap-2 items-center px-4 py-1 hover:bg-gray-100 rounded-sm"
              onClick={handlePay}
            >
              <CircleDollarSign className="w-4.5 h-4.5" />
              <span>Mark as Paid</span>
            </button>
          )}
          {studentCard.paid && (
            <button
              className="flex gap-2 items-center px-4 py-1 hover:bg-gray-100 rounded-sm"
              onClick={handleExpire}
            >
              <Rat className="w-4.5 h-4.5" />
              <span>Expire</span>
            </button>
          )}
        </div>
      </Menu>
    </div>
  );
};

export default StudentCard;
