"use client";

import Link from "next/link";
import { ChevronLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineInviteStudent,
  useGetLineInvitesQuery,
  useMarkLineInviteSentMutation,
} from "@/store/slices/students";

const InviteRow = ({ student }: { student: LineInviteStudent }) => {
  const [markSent] = useMarkLineInviteSentMutation();
  const sent = Boolean(student.lineInviteSentAt);

  // Clipboard first, synchronously inside the tap — iOS Safari rejects a write
  // that comes after an await. Recording「已邀請」can follow.
  const handleCopy = () => {
    if (!student.inviteMessage) return;
    navigator.clipboard.writeText(student.inviteMessage).then(
      () => {
        toast.success(`已複製 ${student.name} 的邀請，貼到 LINE 傳給他`);
        markSent({ id: student.id }).catch(() => {});
      },
      () => toast.error("無法複製，請稍後再試")
    );
  };

  return (
    <li className="flex items-center gap-3 py-3 border-b border-neutral-100 last:border-b-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={student.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
      <Link href={`/students/${student.id}`} className="flex-1 min-w-0 hover:underline">
        <p className="font-medium truncate">{student.name}</p>
        <p className="text-xs text-neutral-500">
          {student.lastAttendAt ? `上次出席 ${formatDate(student.lastAttendAt, "M/d")}` : "還沒出席過"}
          {" · "}
          {sent ? `${formatDate(student.lineInviteSentAt, "M/d")} 已邀請` : "尚未邀請"}
        </p>
      </Link>
      <button
        type="button"
        disabled={!student.inviteMessage}
        onClick={handleCopy}
        className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 ${
          sent
            ? "border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
            : "bg-primary-700 text-white hover:bg-primary-900"
        }`}
      >
        <Copy className="w-4 h-4" />
        {sent ? "再複製" : "複製邀請"}
      </button>
    </li>
  );
};

/**
 * 未綁定 LINE 的學員清單（設計稿 C4）。上課前把舊學員綁好，現場只剩第一次來的人
 * 需要幫忙。系統沒辦法主動傳訊息給還沒加官方帳號的人，所以由老師複製邀請自己傳。
 */
const LineInvites = () => {
  const { data, isLoading } = useGetLineInvitesQuery();
  const notConfigured = data?.students.some((s) => !s.inviteMessage);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-5 lg:mx-0 lg:px-8">
      <Link
        href="/students"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        學生
      </Link>
      <div>
        <h1 className="text-xl font-semibold">未綁定 LINE 的學員</h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          上課前先邀請綁好，之後學生就能用 LINE 自己報到、看剩幾堂。依最近出席排序。
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2.5 text-sm">
            <span>
              已綁定 <b>{data.boundCount}</b> / {data.totalCount} 人
            </span>
            {data.students.length > 0 && (
              <span className="text-neutral-500">還差 {data.students.length} 人</span>
            )}
          </div>
          {notConfigured && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800">
              LINE 綁定尚未設定完成（缺少官方帳號 ID），暫時無法產生邀請。
            </p>
          )}
          {data.students.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">所有學員都綁好 LINE 了</p>
          ) : (
            <ul>
              {data.students.map((student) => (
                <InviteRow key={student.id} student={student} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default LineInvites;
