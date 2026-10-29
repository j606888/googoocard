"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TAB_LABELS = ["課卡", "出席", "動態"];

/** 一張有效課卡的形狀：卡名、編號、狀態、大字剩餘、進度條、金額。 */
const CardSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-5.5 w-14" />
    </div>
    <Skeleton className="h-7 w-20" />
    <Skeleton className="h-1.5 w-full" />
    <div className="flex justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
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
        className={`@container flex-none bg-white ${
          compact ? "px-4 pt-1" : variant === "pane" ? "px-6 pt-5" : "px-8 pt-5"
        }`}
      >
        {variant === "page" && backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            學生
          </Link>
        )}
        <div aria-hidden="true">
          <div className={`flex items-center ${compact ? "gap-3.5" : "gap-4"}`}>
            <Skeleton className={`${variant === "pane" ? "size-12" : "size-14"} shrink-0`} />
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

      <div className={`flex-none bg-white border-b border-neutral-200 pt-3 ${compact ? "" : "px-6"}`}>
        <div className={`flex gap-1 ${compact ? "" : "w-fit"}`}>
          {(compact ? [...TAB_LABELS, "資料"] : TAB_LABELS).map((label, i) => (
            <span
              key={label}
              className={`${compact ? "flex-1 text-center" : ""} -mb-px min-h-11 px-3.5 text-sm leading-11 border-b-2 ${
                i === 0 ? "border-primary-600 text-primary-900 font-bold" : "border-transparent text-neutral-500 font-medium"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={`flex-1 bg-neutral-50 ${compact ? "px-4 py-4" : "px-6 py-6"}`} aria-hidden="true">
        <Skeleton className="h-3.5 w-36 mb-3" />
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          <CardSkeleton />
          <CardSkeleton className="opacity-50" />
        </div>
      </div>
    </div>
  );
};

export default StudentDetailSkeleton;
