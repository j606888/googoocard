import type { StudentCardWithCard } from "@/store/slices/students";

const pill = "shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap";

/**
 * 一張課卡的狀態 pill：複習／轉換／已轉換／已付款／未付款。
 * 摘要卡和詳情對話框共用，順序固定。
 */
const CardStatusPills = ({
  studentCard,
  showPaid = true,
}: {
  studentCard: StudentCardWithCard;
  /** 已結束的卡不再強調「已付款」。 */
  showPaid?: boolean;
}) => (
  <div className="flex items-center gap-1 flex-wrap justify-end">
    {studentCard.card.isPracticeCard && (
      <span className={`${pill} bg-warning-100 text-warning-900`}>複習</span>
    )}
    {studentCard.origin === "CONVERSION" && (
      <span className={`${pill} bg-primary-100 text-primary-900`}>轉換</span>
    )}
    {studentCard.convertedToId && (
      <span className={`${pill} bg-neutral-100 text-neutral-600`}>已轉換</span>
    )}
    {studentCard.isPaid === false ? (
      <span className={`${pill} bg-danger-100 text-danger-700`}>未付款</span>
    ) : (
      showPaid && <span className={`${pill} bg-primary-50 text-primary-900`}>已付款</span>
    )}
  </div>
);

export default CardStatusPills;
