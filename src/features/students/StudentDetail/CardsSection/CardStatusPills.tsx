import type { StudentCardWithCard } from "@/store/slices/students";
import StatusTag from "@/components/StatusTag";

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
      <StatusTag tone="warning">複習</StatusTag>
    )}
    {studentCard.origin === "CONVERSION" && (
      <StatusTag tone="positive">轉換</StatusTag>
    )}
    {studentCard.convertedToId && (
      <StatusTag tone="neutral">已轉換</StatusTag>
    )}
    {studentCard.isPaid === false ? (
      <StatusTag tone="danger">未付款</StatusTag>
    ) : (
      showPaid && <StatusTag tone="positive">已付款</StatusTag>
    )}
  </div>
);

export default CardStatusPills;
