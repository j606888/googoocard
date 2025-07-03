import {
  StudentCardWithCard,
  useExpireStudentCardMutation,
} from "@/store/slices/students";
import { formatDate } from "@/lib/utils";
import { EllipsisVertical, Rat } from "lucide-react";
import Menu from "@/components/Menu";
import { useRef, useState } from "react";

const StudentCard = ({ studentCard }: { studentCard: StudentCardWithCard }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasDiscount = studentCard.basePrice !== studentCard.finalPrice;
  const disabled =
    studentCard.remainingSessions === 0 || !!studentCard.expiredAt;
  const [menuOpen, setMenuOpen] = useState(false);
  const [expireStudentCard] = useExpireStudentCardMutation();

  const handleExpire = async () => {
    await expireStudentCard({
      id: studentCard.studentId,
      studentCardId: studentCard.id,
    });
    setMenuOpen(false);
  };

  return (
    <div
      key={studentCard.id}
      className={`relative flex flex-col gap-2 p-3 rounded-sm shadow-sm ${
        disabled ? "bg-[#F4F4F4]" : "bg-primary-50"
      }`}
    >
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
        <button
          className="flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm"
          onClick={handleExpire}
        >
          <Rat className="w-4.5 h-4.5" />
          <span>Expire</span>
        </button>
      </Menu>
    </div>
  );
};

export default StudentCard;
