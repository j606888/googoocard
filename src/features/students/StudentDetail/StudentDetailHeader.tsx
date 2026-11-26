"use client";

import Link from "next/link";
import { ArrowLeft, Archive, ChevronLeft, QrCode, SquarePen } from "lucide-react";
import { toast } from "sonner";
import {
  StudentWithDetail,
  useGetStudentLineBindLinkQuery,
  useSetStudentArchivedMutation,
} from "@/store/slices/students";
import LineBindQrButton from "./LineBindQrButton";
import EditStudent from "./BasicSection/EditStudent";
import BuyCard from "./CardsSection/BuyCard";
import StudentActionsMenu from "./StudentActionsMenu";
import { DanceBadges } from "../StudentList/DanceBadge";
import { NEEDS_RENEWAL_TAG } from "../StudentList/studentFilters";
import { Button, buttonVariants } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";

const ArchivedBanner = ({ student }: { student: StudentWithDetail }) => {
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();
  return (
    <div className="mb-4 flex min-h-11 items-center gap-3 border-b border-line pb-2 text-sm text-ink-2">
      <Archive aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
      <span className="flex-1">這位學生已封存，不會出現在名單、自助簽到和 LINE。</span>
      <Button
        type="button"
        variant="text"
        size="sm"
        isLoading={isLoading}
        className="-mr-2"
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

/**
 * 還沒綁 LINE：頁首就標出來，點一下直接開綁定 QR 讓學生當場掃
 * （原本只在「資料」分頁裡，找不到）。已綁定就不佔位置。
 */
const LineUnboundBadge = ({ student }: { student: StudentWithDetail }) => {
  const { data } = useGetStudentLineBindLinkQuery({ id: student.id }, { skip: Boolean(student.archivedAt) });
  if (!data || data.bound) return null;
  const tag = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";
  if (!data.deepLink) {
    return <span className={`${tag} bg-band text-ink-2`}>未綁 LINE</span>;
  }
  return (
    <LineBindQrButton
      deepLink={data.deepLink}
      studentName={student.name}
      className={`${tag} bg-band text-ink-2 hover:bg-[#06C755] hover:text-white transition-colors`}
    >
      <QrCode className="w-3.5 h-3.5" />
      未綁 LINE · 綁定 QR
    </LineBindQrButton>
  );
};

/** 舞種資格（全名）、已經沒卡、其他標籤、未綁 LINE——三種頁首共用。 */
const StudentBadges = ({ student }: { student: StudentWithDetail }) => {
  const tags = student.tags ?? [];
  const needsRenewal = tags.some((tag) => tag.name === NEEDS_RENEWAL_TAG);
  const otherTags = tags.filter((tag) => tag.name !== NEEDS_RENEWAL_TAG);
  return (
    <>
      <DanceBadges levels={student.danceLevels} variant="full" />
      {/* 系統標籤「Needs Renewal」畫面上一律叫「已經沒卡」 */}
      {needsRenewal && <span className="text-[13px] font-semibold text-warning-800">已經沒卡</span>}
      {otherTags.map((tag) => (
        <StatusTag key={tag.id} tone="neutral">
          {tag.name}
        </StatusTag>
      ))}
      <LineUnboundBadge student={student} />
    </>
  );
};

/**
 * 手機版頁首：白色 app bar（返回／編輯／⋯）、大頭貼與姓名。
 * 購買課卡不在這裡——手機的課卡分頁底部有一顆固定的。
 */
const CompactHeader = ({
  student,
  backHref,
}: {
  student: StudentWithDetail;
  backHref: string;
}) => (
  <div>
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
    <div className="px-5 pt-1">
      {student.archivedAt && <ArchivedBanner student={student} />}
      <div className="flex items-center gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={student.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold text-ink flex items-baseline gap-2 flex-wrap">
            {student.name}
            <span className="text-[13px] font-medium tabular-nums text-ink-3">#{student.number}</span>
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <StudentBadges student={student} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const moreButton =
  "inline-flex items-center justify-center size-11 rounded-xl text-ink-2 hover:bg-primary-50 hover:text-ink cursor-pointer transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300";

/**
 * 學生詳情的頁首：大頭貼、姓名（旁邊一支編輯鉛筆）、舞種資格與標籤，右邊是
 * 「購買課卡」與 ⋯。剩幾堂看課卡分頁、出席數字看出席分頁，頁首不再放數據列。
 * 分頁列接在它下面（StudentDetail），兩者合起來是一塊白色頁首。桌面刻意壓矮，
 * 把高度留給分頁內容。
 *
 * "page"    —— 桌面獨立學生頁，多一行返回名單的麵包屑。
 * "pane"    —— 右側抽屜：頭像縮小；換學生／開啟完整頁／關閉在抽屜自己的頂列（StudentsTableView）。
 * "compact" —— 手機：app bar ＋ 大頭貼與姓名。
 */
/** 返回連結寫的是「實際會回去的地方」——從課程頁點進來就寫課程，不是一律寫學生。 */
const backLabel = (href: string) =>
  href.startsWith("/lessons") ? "課程" : href.startsWith("/cards") ? "課卡" : "學生";

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
    <div className={`@container flex-none ${isPane ? "px-6 pt-5" : "px-8 pt-5"}`}>
      {!isPane && (
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1 -mt-2 mb-1 text-sm text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel(backHref)}
        </Link>
      )}

      {student.archivedAt && <ArchivedBanner student={student} />}

      <div className={`flex items-center flex-wrap ${isPane ? "gap-3.5" : "gap-4"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={student.avatarUrl}
          alt=""
          className={`${isPane ? "w-14 h-14" : "w-16 h-16"} rounded-full object-cover shrink-0`}
        />
        <div className="flex-1 min-w-40">
          <div className="flex items-center gap-1 flex-wrap">
            <h1
              className={`${isPane ? "text-[22px]" : "text-[26px]"} font-semibold text-ink flex items-baseline gap-2 flex-wrap`}
            >
              {student.name}
              <span className="text-[13px] font-medium tabular-nums text-ink-3">#{student.number}</span>
            </h1>
            <EditStudent
              student={student}
              trigger={(open) => (
                <button
                  type="button"
                  aria-label="編輯學生資料"
                  title="編輯學生資料"
                  className={`${buttonVariants({ variant: "ghost", size: "iconSm" })} text-ink-3 hover:text-ink`}
                  onClick={open}
                >
                  <SquarePen className="w-4 h-4" />
                </button>
              )}
            />
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <StudentBadges student={student} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!student.archivedAt && <BuyCard student={student} variant="header" />}
          <StudentActionsMenu student={student} buttonClassName={moreButton} />
        </div>
      </div>
    </div>
  );
};

export default StudentDetailHeader;
