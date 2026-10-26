"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, ChevronLeft, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { StudentWithDetail, useSetStudentArchivedMutation } from "@/store/slices/students";
import EditStudent from "./BasicSection/EditStudent";
import BuyCard from "./CardsSection/BuyCard";
import StudentStats from "./StudentStats";
import StudentActionsMenu from "./StudentActionsMenu";
import { DanceBadges } from "../StudentList/DanceBadge";
import { NEEDS_RENEWAL_TAG, tagLabel } from "../StudentList/studentFilters";
import { Button, buttonVariants } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";

const ArchivedBanner = ({ student }: { student: StudentWithDetail }) => {
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
      <Archive className="w-4 h-4 shrink-0" />
      <span className="flex-1">這位學生已封存，不會出現在名單、自助簽到和 LINE。</span>
      <Button
        type="button"
        variant="link"
        isLoading={isLoading}
        className="text-sm font-semibold"
        onClick={async () => {
          try {
            await setArchived({ id: student.id, archived: false }).unwrap();
            toast.success(`已還原 ${student.name}`);
          } catch {
            toast.error("還原失敗，請稍後再試");
          }
        }}
      >
        還原
      </Button>
    </div>
  );
};

const iconButton = buttonVariants({ variant: "ghost", size: "icon" });

/** 舞種資格（全名）、需續約、其他標籤——三種頁首共用。 */
const StudentBadges = ({ student }: { student: StudentWithDetail }) => {
  const tags = student.tags ?? [];
  const needsRenewal = tags.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
  const otherTags = tags.filter((tag) => tag.name !== NEEDS_RENEWAL_TAG);
  return (
    <>
      <DanceBadges levels={student.danceLevels} variant="full" />
      {needsRenewal && (
        <StatusTag tone="warning">{tagLabel(NEEDS_RENEWAL_TAG)}</StatusTag>
      )}
      {otherTags.map((tag) => (
        <StatusTag key={tag.id} tone="neutral">
          {tag.name}
        </StatusTag>
      ))}
    </>
  );
};

/**
 * 手機版頁首：白色 app bar（返回／編輯／⋯）、大頭貼與姓名、三格數字。
 * 購買課卡不在這裡——手機的課卡分頁底部有一顆固定的。
 */
const CompactHeader = ({
  student,
  backHref,
}: {
  student: StudentWithDetail;
  backHref: string;
}) => (
  <div className="bg-white">
    <div className="flex items-center justify-between px-2 py-1.5">
      <Link href={backHref} aria-label="返回學生列表" className={iconButton}>
        <ChevronLeft className="w-6 h-6" />
      </Link>
      <div className="flex">
        <EditStudent
          student={student}
          trigger={(open) => (
            <button type="button" aria-label="編輯學生" className={iconButton} onClick={open}>
              <SquarePen className="w-5 h-5" />
            </button>
          )}
        />
        <StudentActionsMenu student={student} buttonClassName={iconButton} />
      </div>
    </div>
    <div className="px-4 pt-1">
      {student.archivedAt && <ArchivedBanner student={student} />}
      <div className="flex items-center gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={student.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold text-neutral-900 flex items-baseline gap-2 flex-wrap">
            {student.name}
            <span className="text-xs font-mono font-medium text-neutral-500">#{student.number}</span>
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <StudentBadges student={student} />
          </div>
        </div>
      </div>
      <div className="mt-3.5">
        <StudentStats student={student} variant="compact" />
      </div>
    </div>
  </div>
);

/**
 * 學生詳情的頁首：大頭貼、姓名、舞種資格與標籤、動作按鈕、一行數據列。
 * 分頁列接在它下面（StudentDetail），兩者合起來是一塊白色頁首。桌面刻意壓矮，
 * 把高度留給分頁內容。
 *
 * "page"    —— 桌面獨立學生頁，多一行返回名單的麵包屑。
 * "pane"    —— 右側抽屜：頭像縮小；抽屜自己的「開啟完整頁／關閉」從 `trailing` 接在動作按鈕後面。
 * "compact" —— 手機：app bar ＋ 三格數字。
 */
const StudentDetailHeader = ({
  student,
  backHref = "/students",
  variant = "page",
  trailing,
}: {
  student: StudentWithDetail;
  backHref?: string;
  variant?: "page" | "pane" | "compact";
  /** 動作按鈕最右邊、隔一條細線的小圖示按鈕（抽屜的開啟完整頁／關閉）。 */
  trailing?: ReactNode;
}) => {
  if (variant === "compact") return <CompactHeader student={student} backHref={backHref} />;
  const isPane = variant === "pane";

  return (
    <div className={`@container flex-none bg-white ${isPane ? "px-6 pt-4" : "px-8 pt-5"}`}>
      {!isPane && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          學生
        </Link>
      )}

      {student.archivedAt && <ArchivedBanner student={student} />}

      <div className={`flex items-center flex-wrap ${isPane ? "gap-3" : "gap-4"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={student.avatarUrl}
          alt=""
          className={`${isPane ? "w-12 h-12" : "w-14 h-14"} rounded-full object-cover ring-2 ring-primary-100 shrink-0`}
        />
        <div className="flex-1 min-w-40">
          <h1
            className={`${isPane ? "text-xl" : "text-2xl"} font-bold text-neutral-900 flex items-baseline gap-2 flex-wrap`}
          >
            {student.name}
            <span className="text-sm font-mono font-medium text-neutral-500">#{student.number}</span>
          </h1>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <StudentBadges student={student} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditStudent
            student={student}
            trigger={(open) => (
              <Button type="button" variant="secondary" onClick={open}>
                <SquarePen className="w-4 h-4" />
                編輯
              </Button>
            )}
          />
          <StudentActionsMenu student={student} buttonClassName={buttonVariants({ variant: "secondary", size: "icon" })} />
          {!student.archivedAt && <BuyCard student={student} variant="header" />}
          {trailing && (
            <>
              <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-neutral-200" />
              {trailing}
            </>
          )}
        </div>
      </div>

      <div className={isPane ? "mt-3" : "mt-4"}>
        <StudentStats student={student} />
      </div>
    </div>
  );
};

export default StudentDetailHeader;
