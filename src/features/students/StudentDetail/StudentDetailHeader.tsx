"use client";

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


const outlineButton =
  "h-10 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 inline-flex items-center gap-1.5 hover:bg-neutral-50 cursor-pointer";

const ArchivedBanner = ({ student }: { student: StudentWithDetail }) => {
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
      <Archive className="w-4 h-4 shrink-0" />
      <span className="flex-1">這位學生已封存，不會出現在名單、自助簽到和 LINE。</span>
      <button
        type="button"
        disabled={isLoading}
        className="font-semibold text-primary-900 hover:underline cursor-pointer disabled:opacity-50"
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
      </button>
    </div>
  );
};

const iconButton =
  "w-11 h-11 grid place-items-center rounded-xl text-neutral-900 hover:bg-neutral-100 cursor-pointer";

/** 舞種資格（全名）、需續約、其他標籤——三種頁首共用。 */
const StudentBadges = ({ student }: { student: StudentWithDetail }) => {
  const tags = student.tags ?? [];
  const needsRenewal = tags.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
  const otherTags = tags.filter((tag) => tag.name !== NEEDS_RENEWAL_TAG);
  return (
    <>
      <DanceBadges levels={student.danceLevels} variant="full" />
      {needsRenewal && (
        <span className="text-xs font-semibold bg-danger-100 text-danger-700 rounded-full px-2.5 py-0.5">
          {tagLabel(NEEDS_RENEWAL_TAG)}
        </span>
      )}
      {otherTags.map((tag) => (
        <span
          key={tag.id}
          className="text-xs border border-neutral-300 text-neutral-700 rounded-full px-2.5 py-0.5"
        >
          {tag.name}
        </span>
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
 * 學生詳情的頁首：大頭貼、姓名、舞種資格與標籤、動作按鈕、統計數字。
 * 分頁列接在它下面（StudentDetail），兩者合起來是一塊白色頁首。
 *
 * "page"    —— 桌面獨立學生頁，多一行返回名單的麵包屑。
 * "pane"    —— 分割檢視右欄：左邊名單就是返回路徑。
 * "compact" —— 手機：app bar ＋ 三格數字。
 */
const StudentDetailHeader = ({
  student,
  backHref = "/students",
  variant = "page",
}: {
  student: StudentWithDetail;
  backHref?: string;
  variant?: "page" | "pane" | "compact";
}) => {
  if (variant === "compact") return <CompactHeader student={student} backHref={backHref} />;
  const isPane = variant === "pane";

  return (
    <div className={`@container flex-none bg-white ${isPane ? "px-6 pt-5" : "px-8 pt-5"}`}>
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

      <div className="flex items-start gap-4 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={student.avatarUrl}
          alt=""
          className="w-16 h-16 rounded-full object-cover ring-2 ring-primary-100 shrink-0"
        />
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-bold text-neutral-900 flex items-baseline gap-2.5 flex-wrap">
            {student.name}
            <span className="text-sm font-mono font-medium text-neutral-500">#{student.number}</span>
          </h1>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <StudentBadges student={student} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EditStudent
            student={student}
            trigger={(open) => (
              <button type="button" className={outlineButton} onClick={open}>
                <SquarePen className="w-4 h-4" />
                編輯
              </button>
            )}
          />
          <StudentActionsMenu student={student} buttonClassName={`${outlineButton} px-2.5`} />
          {!student.archivedAt && <BuyCard student={student} variant="header" />}
        </div>
      </div>

      <div className="mt-5">
        <StudentStats student={student} />
      </div>
    </div>
  );
};

export default StudentDetailHeader;
