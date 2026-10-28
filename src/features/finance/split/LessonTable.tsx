"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import type { LessonSplitRow, SplitFlag } from "@/store/slices/finance";
import { dayLabel, money } from "../format";

const FLAG_TEXT: Record<SplitFlag, string> = {
  NO_CARD: "有人沒卡，照暫估",
  MISSING_SHARE_TEACHER: "老師少掛一位？",
  NO_TEACHER: "這堂沒掛老師",
  NO_LOCATION: "沒設分部",
  MANUAL: "手動結算（還沒支援）",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });

const minus = (n: number) => (n ? `−${n.toLocaleString("en-US")}` : "—");

/** 一天的課：收入怎麼分、驗收狀態。驗收頁、當天的帳共用。 */
export default function LessonTable({
  rows,
  nameOf,
  onVerify,
  onEdit,
  busy,
}: {
  rows: LessonSplitRow[];
  nameOf: (teacherId: number | null) => string;
  onVerify: (periodId: number) => void;
  /** 有權限改錢的人才給：手動改實拿。 */
  onEdit?: (row: LessonSplitRow) => void;
  busy: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto lg:-mx-5">
      <table className="w-full min-w-[760px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="bg-neutral-50 text-left text-neutral-600">
            {["時間", "課", "人次", "收入", "場地費", "助教", "抽成", "老師實拿", ""].map((h, i) => (
              <th key={i} className={`px-3 py-2.5 font-medium ${i >= 2 && i <= 6 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.periodId} row={row} nameOf={nameOf} onVerify={() => onVerify(row.periodId)} onEdit={onEdit && (() => onEdit(row))} busy={busy} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  nameOf,
  onVerify,
  onEdit,
  busy,
}: {
  row: LessonSplitRow;
  nameOf: (teacherId: number | null) => string;
  onVerify: () => void;
  onEdit?: () => void;
  busy: boolean;
}) {
  const split = row.split;
  const saved = row.status === "VERIFIED" ? row.verified : null;
  const teacherLines = saved
    ? saved.lines.filter((l) => l.kind === "TEACHER")
    : split?.teacherLines ?? [];
  const needsLook = row.flags.length > 0 && row.status !== "VERIFIED";

  return (
    <tr className={`border-t border-neutral-200 align-top ${needsLook ? "bg-warning-50" : ""}`}>
      <td className="px-3 py-3">{time(row.startTime)}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-neutral-900">{row.lessonName}</div>
        {(needsLook || saved?.overridden) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {needsLook &&
              row.flags.map((flag) => (
                <StatusTag key={flag} tone="warning">
                  {flag === "NO_CARD" && split ? `有人沒卡，暫估 ${money(split.estimated)}` : FLAG_TEXT[flag]}
                </StatusTag>
              ))}
            {saved?.overridden && <StatusTag tone="neutral">手動改過</StatusTag>}
          </div>
        )}
        {split && split.assistantLines.length > 0 && (
          <div className="mt-1 text-xs text-neutral-500">助教 {split.assistantLines.map((l) => nameOf(l.teacherId)).join("、")}</div>
        )}
      </td>
      <td className="px-3 py-3 text-right">{row.attendeeCount}</td>
      {split ? (
        <>
          <td className="px-3 py-3 text-right">{money(saved?.revenue ?? split.revenue)}</td>
          <td className="px-3 py-3 text-right text-warning-950">{minus(split.venueFee)}</td>
          <td className="px-3 py-3 text-right text-warning-950">{minus(split.assistantFee)}</td>
          <td className="px-3 py-3 text-right">{minus(split.commission)}</td>
          <td className="px-3 py-3 font-medium text-neutral-900">
            {teacherLines.length > 0 ? teacherLines.map((l) => `${nameOf(l.teacherId)} ${money(l.amount)}`).join("、") : "—"}
          </td>
        </>
      ) : (
        <td colSpan={5} className="px-3 py-3 text-neutral-500">{row.status === "UPCOMING" ? "還沒上" : "還沒點名"}</td>
      )}
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          {row.status === "VERIFIED" && row.verified && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-primary-900">
              <Check className="size-3.5" />
              {row.verified.by.name} {dayLabel(row.verified.at).split("（")[0]}
            </span>
          )}
          {row.status === "CHANGED" && row.verified && (
            <StatusTag tone="warning">點名改過 {money(row.verified.revenueDiff, { signed: true })}</StatusTag>
          )}
          {(row.status === "PENDING" || row.status === "CHANGED") && (
            <Button size="sm" variant="secondary" disabled={row.flags.includes("MANUAL") || busy} onClick={onVerify}>
              驗收
            </Button>
          )}
          {onEdit && split && !row.flags.includes("MANUAL") && (
            <Button size="sm" variant="link" onClick={onEdit}>
              改實拿
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
