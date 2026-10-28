"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { useGetTeacherMonthQuery, type TeacherMonthPerson } from "@/store/slices/finance";
import { Panel } from "../ui";
import { dayLabel, money } from "../format";
import { financeHref } from "../routes";

const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const parts = (a: { teach: number; venue: number; assistant: number; remainder: number }) =>
  [
    a.teach && `分潤 ${money(a.teach)}`,
    a.venue && `場地費 ${money(a.venue)}`,
    a.assistant && `助教 ${money(a.assistant)}`,
    a.remainder && `零頭 ${money(a.remainder)}`,
  ].filter(Boolean).join(" · ");

/**
 * 老師薪水：每位老師這個月到今天累積多少（每堂點完名就算進去），點一位看逐堂明細。
 * 月結那天才凍結成薪資單。能改水庫的人看全部；其他人只看自己的。
 */
export default function TeacherMonthPage() {
  const thisMonth = toTaipeiMonthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading } = useGetTeacherMonthQuery(month);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const people = data?.people ?? [];
  const selected = people.find((p) => p.teacher.id === selectedId) ?? people[0];
  const [y, m] = month.split("-").map(Number);
  const label = `${y} 年 ${m} 月${month === thisMonth ? " · 到今天" : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">老師薪水</h2>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>每堂點完名就累積進來；還沒驗收的照現在算的，驗收時改了會跟著變。月結那天凍結成薪資單。</p>
            <p className="mt-2">請款、調整在月結時加。沒帳號的老師由老闆代看，可以複製明細傳給他。</p>
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" aria-label="上個月" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums text-neutral-900">{label}</span>
        <Button variant="ghost" size="iconSm" aria-label="下個月" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : people.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-sm text-neutral-500">這個月還沒有點過名的課</p>
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2">
            {people.map((p) => {
              const active = p.teacher.id === selected?.teacher.id;
              return (
                <li key={p.teacher.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(p.teacher.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left",
                      active ? "border-2 border-primary-900 bg-primary-50 px-[15px] py-[11px]" : "border-neutral-200"
                    )}
                  >
                    <TeacherAvatar name={p.teacher.name} color={p.teacher.color} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{p.teacher.name}</span>
                        <span className="text-xs text-neutral-500">{p.teacher.isAssistant ? "助教" : p.teacher.hasAccount ? "成員" : "沒帳號"}</span>
                      </span>
                      <span className="truncate text-[13px] text-neutral-500">{parts(p)}</span>
                      {p.missing.length > 0 && <span className="mt-1"><StatusTag tone="warning">可能少算 {p.missing.length} 堂</StatusTag></span>}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-neutral-900">{money(p.total)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && <Detail person={selected} month={label} />}
        </div>
      )}
    </div>
  );
}

function Detail({ person, month }: { person: TeacherMonthPerson; month: string }) {
  const copy = async () => {
    const lines = [
      `${person.teacher.name} · ${month}`,
      ...person.items.map((i) => `${dayLabel(i.startTime)} ${i.lessonName}　${money(i.total)}`),
      `合計 ${money(person.total)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("複製好了，可以貼給他");
    } catch {
      toast.error("沒有複製成功");
    }
  };

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <TeacherAvatar name={person.teacher.name} color={person.teacher.color} size="sm" />
        <div className="flex flex-1 flex-col">
          <h3 className="text-lg font-bold text-neutral-900">{person.teacher.name}</h3>
          <span className="text-[13px] text-neutral-500">{person.teacher.hasAccount ? "看得到自己的" : "沒帳號 · 老闆代看"}</span>
        </div>
        {!person.teacher.hasAccount && (
          <Button size="sm" variant="secondary" onClick={copy}>複製明細</Button>
        )}
      </div>
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-3xl font-bold text-neutral-900">{money(person.total)}</span>
        <span className="text-sm text-neutral-500">{month}</span>
      </div>
      <ul className="flex flex-col">
        {person.missing.map((m) => (
          <li key={`m${m.periodId}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl bg-warning-50 px-2 py-3">
            <span className="flex flex-col">
              <span className="font-medium tabular-nums text-neutral-900">{dayLabel(m.dateKey)} {m.lessonName}</span>
              <span className="text-[13px] text-warning-950">這堂沒掛到{person.teacher.name}，照課程比例應該有份</span>
            </span>
            <Link href={financeHref.day(m.dateKey)} className="shrink-0 text-sm font-medium text-primary-700">看一下</Link>
          </li>
        ))}
        {person.items.map((i) => (
          <li key={i.periodId} className="flex items-center justify-between gap-3 border-t border-neutral-200 py-3 first:border-t-0">
            <span className="flex min-w-0 flex-col">
              <span className="font-medium tabular-nums text-neutral-900">{dayLabel(i.startTime)} {i.lessonName}</span>
              <span className="text-[13px] text-neutral-500">{parts(i)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {i.status === "VERIFIED" ? (
                <span className="inline-flex items-center gap-1 text-[13px] text-primary-900"><Check className="size-3.5" />已驗收</span>
              ) : (
                <span className="text-[13px] text-warning-950">{i.status === "CHANGED" ? "點名改過" : "待驗收"}</span>
              )}
              <span className="w-20 text-right font-semibold tabular-nums">{money(i.total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
