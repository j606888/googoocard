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

// The only rows on this screen that ask for a decision. Everything else is
// reference — so this list stays short, and each row carries the action.
const AttentionList = ({ items }: { items: AttentionItem[] }) => {
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
          <AttentionRow key={item.student.id} item={item} pathname={pathname} />
        ))}
        {overflow > 0 && (
          <p className="text-xs text-neutral-400 pl-1 pt-0.5">
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
}: {
  item: AttentionItem;
  pathname: string;
}) => {
  const { student, kind, severity } = item;
  const danger = severity === "danger";

  const title =
    kind === "no_card"
      ? item.blockedOnly
        ? "課卡資格不符"
        : "無可用課卡"
      : kind === "consecutive_absence"
      ? `連續缺席 ${item.absenceRun} 堂`
      : `課卡剩 ${item.usableSessions} 堂`;

  const detail =
    kind === "no_card"
      ? item.blockedOnly
        ? "手上的複習卡還缺這個舞種的資格"
        : "今天沒有卡可以扣"
      : kind === "consecutive_absence"
      ? item.lastAttendedStartTime
        ? `最後出席 ${format(new Date(item.lastAttendedStartTime), "M/d")}`
        : ""
      : "再上一次就歸零，是續卡的好時機";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
        danger ? "bg-danger-50 border-danger-200" : "bg-warning-50 border-warning-200"
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
              danger ? "text-danger-600" : "text-warning-900"
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            {title}
          </span>
        </div>
        {detail && (
          <p className="text-[11px] text-neutral-500 truncate">{detail}</p>
        )}
      </div>

      {kind === "consecutive_absence" ? (
        <Link
          href={studentDetailHref(student.id, pathname)}
          className="shrink-0 flex items-center gap-0.5 text-[11.5px] font-bold text-white bg-danger-600 hover:bg-danger-700 rounded-full pl-3 pr-2 py-1.5 transition-colors"
        >
          看學生
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <BuyCardDrawer
          student={student}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className={`shrink-0 text-[11.5px] font-bold text-white rounded-full px-3.5 py-1.5 cursor-pointer transition-colors ${
                danger
                  ? "bg-danger-600 hover:bg-danger-700"
                  : "bg-warning-600 hover:bg-warning-700"
              }`}
            >
              買卡
            </button>
          )}
        />
      )}
    </div>
  );
};

export default AttentionList;
