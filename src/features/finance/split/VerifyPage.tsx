"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import {
  useGetLessonSplitsQuery,
  useVerifyLessonsMutation,
  type LessonSplitRow,
  type SplitFlag,
} from "@/store/slices/finance";
import { Panel } from "../ui";
import { dayLabel, errorText, money } from "../format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 這一週（日～六）的頭尾台北日期；offset ＝ 往前幾週。 */
function weekRange(offset: number) {
  const today = parseTaipeiDateRange(toTaipeiDateKey(new Date())).start;
  const weekday = new Date(today.getTime() + 8 * 60 * 60 * 1000).getUTCDay();
  const start = new Date(today.getTime() - (weekday + offset * 7) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { from: toTaipeiDateKey(start), to: toTaipeiDateKey(end) };
}

const FLAG_TEXT: Record<SplitFlag, string> = {
  NO_CARD: "有人沒卡，照暫估",
  MISSING_SHARE_TEACHER: "老師少掛一位？",
  NO_TEACHER: "這堂沒掛老師",
  NO_LOCATION: "沒設分部",
  MANUAL: "手動結算（還沒支援）",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });

/**
 * 每堂驗收：點完名的課自動帶進來、算好分帳，這裡做第二次驗收。
 * 誰都可以驗收（看得到水庫就行），會記下是誰。
 */
export default function VerifyPage() {
  const [offset, setOffset] = useState(0);
  const range = weekRange(offset);
  const { data: rows, isLoading } = useGetLessonSplitsQuery(range);
  const { data: teachers } = useGetTeachersQuery();
  const [verify, { isLoading: verifying }] = useVerifyLessonsMutation();

  const nameOf = useMemo(() => {
    const names = new Map((teachers ?? []).map((t) => [t.id, t.name]));
    return (id: number | null) => (id === null ? "場地" : names.get(id) ?? "？");
  }, [teachers]);

  const days = useMemo(() => {
    const map = new Map<string, LessonSplitRow[]>();
    for (const row of rows ?? []) map.set(row.dateKey, [...(map.get(row.dateKey) ?? []), row]);
    return [...map.entries()];
  }, [rows]);

  const clean = (rows ?? []).filter(
    (r) => (r.status === "PENDING" || r.status === "CHANGED") && r.flags.length === 0
  );

  const run = async (periodIds: number[], batch: boolean) => {
    try {
      const result = await verify({ periodIds, batch }).unwrap();
      if (result.verified.length > 0) toast.success(`驗收了 ${result.verified.length} 堂`);
      else toast.error("沒有可以驗收的堂");
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">每堂驗收</h2>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>點完名的課自動帶進來、照分帳規則算好，這裡做第二次驗收。誰都可以驗收，會記下是誰。</p>
            <p className="mt-2">沒問題的可以整批驗收；有提醒的（例如有人沒卡、照暫估）要一堂一堂按。</p>
            <p className="mt-2">驗收後點名又被改，那堂會退回「點名改過」，要再驗收一次。</p>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" aria-label="上一週" onClick={() => setOffset(offset + 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums text-neutral-900">
          {dayLabel(parseTaipeiDateRange(range.from).start)} – {dayLabel(parseTaipeiDateRange(range.to).start)}
        </span>
        <Button variant="ghost" size="iconSm" aria-label="下一週" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
          <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" disabled={clean.length === 0} isLoading={verifying} onClick={() => run(clean.map((r) => r.periodId), true)}>
          驗收沒問題的 {clean.length} 堂
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : days.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-sm text-neutral-500">這週沒有課</p>
        </Panel>
      ) : (
        days.map(([dateKey, dayRows]) => (
          <Panel key={dateKey} title={dayLabel(parseTaipeiDateRange(dateKey).start)}>
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
                  {dayRows.map((row) => (
                    <LessonRow key={row.periodId} row={row} nameOf={nameOf} onVerify={() => run([row.periodId], false)} verifying={verifying} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}

function LessonRow({
  row,
  nameOf,
  onVerify,
  verifying,
}: {
  row: LessonSplitRow;
  nameOf: (id: number | null) => string;
  onVerify: () => void;
  verifying: boolean;
}) {
  const split = row.split;
  const teachers = split
    ? [...split.teacherLines.map((l) => `${nameOf(l.teacherId)} ${money(l.amount)}`)]
    : [];
  return (
    <tr className={`border-t border-neutral-200 align-top ${row.flags.length > 0 && row.status !== "VERIFIED" ? "bg-warning-50" : ""}`}>
      <td className="px-3 py-3">{time(row.startTime)}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-neutral-900">{row.lessonName}</div>
        {row.flags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {row.flags.map((flag) => (
              <StatusTag key={flag} tone="warning">
                {flag === "NO_CARD" && split ? `有人沒卡，暫估 ${money(split.estimated)}` : FLAG_TEXT[flag]}
              </StatusTag>
            ))}
          </div>
        )}
        {split && split.assistantLines.length > 0 && (
          <div className="mt-1 text-xs text-neutral-500">助教 {split.assistantLines.map((l) => nameOf(l.teacherId)).join("、")}</div>
        )}
      </td>
      <td className="px-3 py-3 text-right">{row.attendeeCount}</td>
      {split ? (
        <>
          <td className="px-3 py-3 text-right">{money(split.revenue)}</td>
          <td className="px-3 py-3 text-right text-warning-950">{split.venueFee ? `−${split.venueFee.toLocaleString("en-US")}` : "—"}</td>
          <td className="px-3 py-3 text-right text-warning-950">{split.assistantFee ? `−${split.assistantFee.toLocaleString("en-US")}` : "—"}</td>
          <td className="px-3 py-3 text-right">{split.commission ? `−${split.commission.toLocaleString("en-US")}` : "—"}</td>
          <td className="px-3 py-3 font-medium text-neutral-900">{teachers.length > 0 ? teachers.join("、") : "—"}</td>
        </>
      ) : (
        <td colSpan={5} className="px-3 py-3 text-neutral-500">{row.status === "UPCOMING" ? "還沒上" : "還沒點名"}</td>
      )}
      <td className="px-3 py-3 text-right">
        <StatusCell row={row} onVerify={onVerify} verifying={verifying} />
      </td>
    </tr>
  );
}

function StatusCell({ row, onVerify, verifying }: { row: LessonSplitRow; onVerify: () => void; verifying: boolean }) {
  if (row.status === "VERIFIED" && row.verified) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-primary-900">
        <Check className="size-3.5" />
        {row.verified.by.name} {dayLabel(row.verified.at).split("（")[0]}
      </span>
    );
  }
  if (row.status !== "PENDING" && row.status !== "CHANGED") return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {row.status === "CHANGED" && row.verified && (
        <StatusTag tone="warning">點名改過 {money(row.verified.revenueDiff, { signed: true })}</StatusTag>
      )}
      <Button size="sm" variant="secondary" disabled={row.flags.includes("MANUAL")} isLoading={verifying} onClick={onVerify}>
        驗收
      </Button>
    </div>
  );
}
