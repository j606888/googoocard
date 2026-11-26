"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TAB_LABELS = ["課卡", "出席", "動態"];

/** 一列有效課卡的形狀：卡名＋編號、一行說明，右邊大字剩餘與圓點。沒有框。 */
const CardRowSkeleton = ({ className = "" }: { className?: string }) => (
  <li className={`flex min-h-16 items-center justify-between gap-3 py-3.5 ${className}`}>
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
    <div className="flex flex-col items-end gap-2.5">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-3 w-28" />
    </div>
  </li>
);

/**
 * 學生詳情載入中：跟 `StudentDetailHeader` ＋ `StudentDetail` 同一個版面——大頭貼、
 * 姓名、分頁列、課卡。返回連結與分頁名稱是真的，只有資料是骨架。
 */
const StudentDetailSkeleton = ({
  variant = "page",
  backHref,
}: {
  variant?: "page" | "pane" | "compact";
  /** `page` 的麵包屑。 */
  backHref?: string;
}) => {
  const compact = variant === "compact";
  return (
    <div className="flex flex-col flex-1">
      <div
        className={`@container flex-none ${
          compact ? "px-5 pt-1" : variant === "pane" ? "px-6 pt-5" : "px-8 pt-5"
        }`}
      >
        {variant === "page" && backHref && (
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1 -mt-2 mb-1 text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
            學生
          </Link>
        )}
        <div aria-hidden="true">
          <div className={`flex items-center ${compact ? "gap-3.5" : "gap-4"}`}>
            <Skeleton className={`${variant === "pane" ? "size-14" : "size-16"} shrink-0`} />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5.5 w-16 rounded-sm" />
                <Skeleton className="h-5.5 w-12" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`flex-none border-b border-line pt-3 ${compact ? "" : "px-6"}`}>
        <div className={`flex gap-1 ${compact ? "" : "w-fit"}`}>
          {(compact ? [...TAB_LABELS, "資料"] : TAB_LABELS).map((label, i) => (
            <span
              key={label}
              className={`${compact ? "flex-1 text-center" : ""} -mb-px min-h-11 px-3.5 text-sm leading-11 border-b-2 ${
                i === 0 ? "border-primary-600 text-primary-900 font-bold" : "border-transparent text-ink-3 font-medium"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={`flex-1 ${compact ? "px-5 pt-5" : "px-6 pt-6"}`} aria-hidden="true">
        <Skeleton className="h-5 w-24 mb-1" />
        <ul className="m-0 p-0 list-none divide-y divide-line border-b border-line">
          <CardRowSkeleton />
          <CardRowSkeleton className="opacity-50" />
        </ul>
      </div>
    </div>
  );
};

export default StudentDetailSkeleton;
