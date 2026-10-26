"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, ChevronRight } from "lucide-react";
import { studentDetailHref } from "@/lib/studentNav";
import {
  MAX_ATTENTION_ROWS,
  type AttentionItem,
} from "@/domains/attendance/rosterInsights";
import BuyCardDrawer from "../BuyCardDrawer";
import { Button } from "@/components/ui/button";

// The only rows on this screen that ask for a decision. Everything else is
// reference — so this list stays short, and each row carries the action.
const AttentionList = ({
  items,
  acceptedCardNames,
}: {
  items: AttentionItem[];
  /** The lesson's cards — named in the「沒有這門課可用的卡」row. */
  acceptedCardNames: string[];
}) => {
  const pathname = usePathname();

  if (items.length === 0) return null;

  const shown = items.slice(0, MAX_ATTENTION_ROWS);
  const overflow = items.length - shown.length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <h3 className="text-sm font-bold text-neutral-700">需要注意</h3>
        <span className="text-[10.5px] font-bold text-white bg-danger-600 rounded-full px-1.5 py-px">
          {items.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {shown.map((item) => (
          <AttentionRow
            key={item.student.id}
            item={item}
            pathname={pathname}
            acceptedCardNames={acceptedCardNames}
          />
        ))}
        {overflow > 0 && (
          <p className="text-xs text-neutral-500 pl-1 pt-0.5">
            還有 {overflow} 位
          </p>
        )}
      </div>
    </section>
  );
};

const AttentionRow = ({
  item,
  pathname,
  acceptedCardNames,
}: {
  item: AttentionItem;
  pathname: string;
  acceptedCardNames: string[];
}) => {
  const { student, kind, severity } = item;
  const danger = severity === "danger";

  // "No card" splits three ways: a lesson card they may not spend yet
  // (qualification), sessions only on cards this lesson doesn't take, or
  // genuinely nothing. The middle one used to read「今天沒有卡可以扣」and sent
  // teachers to sell a card to students who had sessions in hand.
  const hasOtherCards = item.otherSessions > 0;
  const accepted = acceptedCardNames.join("、");
  const title =
    kind === "no_card"
      ? item.blockedOnly
        ? "課卡資格不符"
        : hasOtherCards
          ? "沒有這門課可用的卡"
          : "沒有任何可用課卡"
      : kind === "consecutive_absence"
      ? `連續缺席 ${item.absenceRun} 堂`
      : `課卡剩 ${item.usableSessions} 堂`;

  const detail =
    kind === "no_card"
      ? item.blockedOnly
        ? "手上的複習卡還缺這個舞種的資格"
        : hasOtherCards
          ? `手上另有 ${item.otherSessions} 堂其他卡${accepted ? `，本課只接受：${accepted}` : ""}`
          : "需要先買卡才能扣這門課"
      : kind === "consecutive_absence"
      ? item.lastAttendedStartTime
        ? `最後出席 ${format(new Date(item.lastAttendedStartTime), "M/d")}`
        : ""
      : "再上一次就歸零，是續卡的好時機";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
        danger ? "bg-danger-50 border-danger-200" : "bg-warning-50 border-warning-300"
      }`}
    >
      <Image
        src={student.avatarUrl}
        alt={student.name}
        width={30}
        height={30}
        className="rounded-full shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-900 truncate">
            {student.name}
          </span>
          <span
            className={`flex items-center gap-1 text-[10.5px] font-bold shrink-0 ${
              danger ? "text-danger-700" : "text-warning-950"
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            {title}
          </span>
        </div>
        {detail && (
          <p className="text-[11px] text-neutral-500 line-clamp-2">{detail}</p>
        )}
      </div>

      {kind === "consecutive_absence" ? (
        <Button asChild variant="dangerSecondary" size="sm" className="gap-0.5 pr-2.5">
          <Link href={studentDetailHref(student.id, pathname)}>
            看學生
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <BuyCardDrawer
          student={student}
          trigger={(open) => (
            <Button
              type="button"
              variant={danger ? "dangerSecondary" : "secondary"}
              size="sm"
              onClick={open}
            >
              買卡
            </Button>
          )}
        />
      )}
    </div>
  );
};

export default AttentionList;
