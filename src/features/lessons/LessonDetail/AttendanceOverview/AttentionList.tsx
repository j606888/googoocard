"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight, Info } from "lucide-react";
import { studentDetailHref } from "@/lib/studentNav";
import {
  MAX_ATTENTION_ROWS,
  type AttentionItem,
} from "@/domains/attendance/rosterInsights";
import BuyCardDrawer from "../BuyCardDrawer";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// The only rows on this screen that ask for a decision. Everything else is
// reference — so this list stays short, and each row carries the action.
// One bordered card, a divider between rows; the reason sits behind ⓘ.
const AttentionList = ({
  items,
  acceptedCardNames,
}: {
  items: AttentionItem[];
  /** The lesson's cards — named in the「沒有這門課可用的卡」reason. */
  acceptedCardNames: string[];
}) => {
  const pathname = usePathname();

  if (items.length === 0) return null;

  const shown = items.slice(0, MAX_ATTENTION_ROWS);
  const overflow = items.length - shown.length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <h3 className="text-base font-bold text-neutral-900">需要注意</h3>
        <span className="text-sm text-neutral-500">{items.length}</span>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {shown.map((item) => (
          <AttentionRow
            key={item.student.id}
            item={item}
            pathname={pathname}
            acceptedCardNames={acceptedCardNames}
          />
        ))}
      </ul>
      {overflow > 0 && (
        <p className="text-[13px] text-neutral-500 pl-1 pt-2">還有 {overflow} 位</p>
      )}
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

  // The tag says what; ⓘ says why. "No card" splits three ways in the reason
  // only — the tag and the action (買卡) are the same for all three.
  const tag = kind === "no_card" ? "沒有可用的卡" : title;
  const reason = kind === "no_card" ? [title, detail].filter(Boolean).join("：") : detail;

  return (
    <li className="flex min-h-15 items-center gap-2.5 py-2 pr-3 pl-3.5">
      <Image
        src={student.avatarUrl}
        alt=""
        width={34}
        height={34}
        className="rounded-full shrink-0"
      />
      <Link
        href={studentDetailHref(student.id, pathname)}
        className="min-w-0 truncate text-[15px] font-semibold text-neutral-900 hover:text-primary-700"
      >
        {student.name}
      </Link>
      <StatusTag tone={severity}>{tag}</StatusTag>
      {reason && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${student.name}：為什麼`}
              className="-ml-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-neutral-400 hover:text-neutral-600"
            >
              <Info className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3 text-[13px] text-neutral-700">
            {reason}
          </PopoverContent>
        </Popover>
      )}
      <span className="flex-1" />

      {kind === "consecutive_absence" ? (
        <Button asChild variant="secondary" size="sm" className="gap-0.5 pr-2.5">
          <Link href={studentDetailHref(student.id, pathname)}>
            看學生
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <BuyCardDrawer
          student={student}
          trigger={(open) => (
            <Button type="button" variant="secondary" size="sm" onClick={open}>
              買卡
            </Button>
          )}
        />
      )}
    </li>
  );
};

export default AttentionList;
