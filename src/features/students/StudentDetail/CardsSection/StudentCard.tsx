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

const StudentCard = ({ studentCard, isPublic }: { studentCard: StudentCardWithCard, isPublic?: boolean }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasDiscount = studentCard.basePrice !== studentCard.finalPrice;
  const disabled =
    studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [expireStudentCard] = useExpireStudentCardMutation();
  const [markStudentCardAsPaid] = useMarkStudentCardAsPaidMutation();

  const handleExpire = async () => {
    const confirm = window.confirm(
      "Are you sure you want to expire this card?"
    );
    if (!confirm) return;

    await expireStudentCard({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    setMenuOpen(false);
    toast.success("Card expired");
  };

  const handlePay = async () => {
    const confirm = window.confirm(
      "Are you sure you want to mark this card as paid?"
    );
    if (!confirm) return;

    await markStudentCardAsPaid({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    setMenuOpen(false);
    toast.success("Card marked as paid");
  };

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
      <div className="flex justify-between">
        <h4 className="text-sm font-semibold">{studentCard.card.name}</h4>
        {(!disabled || !studentCard.paid) && !isPublic && (
          <button
            className="absolute top-4 right-4"
            ref={buttonRef}
            onClick={() => setMenuOpen(true)}
          >
            <EllipsisVertical className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex">
        <LabelItem label="Price">
          <div className="flex items-center gap-1">
            <span
              className={`text-sm text-gray-600 font-medium ${
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
        </LabelItem>
        <LabelItem label="Sessions">
          <span className="text-sm font-medium">
            {studentCard.remainingSessions} / {studentCard.totalSessions}
          </span>
        </LabelItem>
      </div>
      <div className="flex">
        <LabelItem label="Purchased at">
          <span className="text-xs font-medium">
            {formatDate(studentCard.createdAt)}
          </span>
        </LabelItem>
        <LabelItem label="Purchased at">
          <span className="text-xs font-medium">
            {studentCard.expiredAt ? formatDate(studentCard.expiredAt) : "-"}
          </span>
        </LabelItem>
      </div>
      {studentCard.attendanceRecords.length > 0 && (
        <div className="flex flex-col px-3 bg-white rounded-sm mt-2">
          {studentCard.attendanceRecords.map((record, index) => (
            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
              <span className="text-xs font-medium">{record.lessonName}</span>
              <span className="text-xs text-gray-700">
                {formatDate(record.periodStartTime)}
              </span>
            </div>
          ))}
        </div>
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

const LabelItem = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
};

export default StudentCard;
