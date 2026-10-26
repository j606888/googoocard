"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Lesson, TrialEntry, useGetLessonTrialsQuery } from "@/store/slices/lessons";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import RegisterTrialDrawer from "./RegisterTrialDrawer";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import StatusTag, { type StatusTone } from "@/components/StatusTag";

const PAYMENT_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

/**
 * 體驗名單（只在掛了體驗卡的課出現）：報名的人（Google 表單、現場）由老師
 * 登記在這裡、上課前就收費，點名時會自動勾好並扣這張體驗卡。學生端不賣體驗卡。
 */
const TrialRoster = ({ lesson }: { lesson: Lesson }) => {
  const hasTrialCard = (lesson.cards ?? []).some((card) => card.isTrial);
  const { data } = useGetLessonTrialsQuery({ id: lesson.id }, { skip: !hasTrialCard });
  const [registering, setRegistering] = useState(false);
  const [showAttended, setShowAttended] = useState(false);

  if (!hasTrialCard || !data) return null;

  const registered = data.entries.filter((entry) => entry.status === "registered");
  const attended = data.entries.filter((entry) => entry.status === "attended");
  const unpaid = registered.filter((entry) => !entry.isPaid);
  const canRegister = data.trialCards.length > 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-bold text-neutral-900">體驗名單</h3>
          <p className="text-[13px] text-neutral-600">
            {registered.length} 人報名
            {unpaid.length > 0 && <span className="text-warning-900">・{unpaid.length} 人還沒收錢</span>}
            {attended.length > 0 && `・${attended.length} 人已上課`}
          </p>
        </div>
        {canRegister && (
          <Button type="button" size="sm" onClick={() => setRegistering(true)}>
            <Plus className="size-4" />
            登記體驗
          </Button>
        )}
      </div>

      {registered.length === 0 ? (
        <EmptyState
          kind="inline"
          title="還沒有人報名"
          description="把 Google 表單或現場報名的人登記進來，上課點名時會自動勾好。"
        />
      ) : (
        <ul className="flex flex-col">
          {registered.map((entry) => (
            <EntryRow key={entry.studentCardId} entry={entry} />
          ))}
        </ul>
      )}

      {attended.length > 0 && (
        <div className="flex flex-col">
          <button
            type="button"
            aria-expanded={showAttended}
            onClick={() => setShowAttended((v) => !v)}
            className="self-start flex items-center gap-1 min-h-9 text-[13px] font-medium text-neutral-600 cursor-pointer"
          >
            已上過體驗 {attended.length} 人
            <ChevronDown className={`w-4 h-4 transition-transform ${showAttended ? "rotate-180" : ""}`} />
          </button>
          {showAttended && (
            <ul className="flex flex-col">
              {attended.map((entry) => (
                <EntryRow key={entry.studentCardId} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      )}

      {registering && (
        <RegisterTrialDrawer
          lessonId={lesson.id}
          trialCards={data.trialCards}
          registeredStudentIds={registered.map((entry) => entry.student.id)}
          onClose={() => setRegistering(false)}
        />
      )}
    </section>
  );
};

const EntryRow = ({ entry }: { entry: TrialEntry }) => {
  const payment: { text: string; tone: StatusTone } =
    entry.finalPrice === 0
      ? { text: "免費", tone: "neutral" }
      : entry.isPaid
        ? {
            text: `已收 $${formatMoney(entry.finalPrice)}${entry.paymentMethod ? `・${PAYMENT_LABEL[entry.paymentMethod]}` : ""}`,
            tone: "positive",
          }
        : { text: `待收 $${formatMoney(entry.finalPrice)}`, tone: "warning" };

  return (
    <li>
      <Link
        href={`/students/${entry.student.id}`}
        className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 -mx-2 px-2 rounded-lg"
      >
        <img src={entry.student.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-semibold truncate">{entry.student.name}</span>
          <span className="text-xs text-neutral-500">
            {entry.status === "attended" && entry.attendedAt
              ? `${formatDate(entry.attendedAt, "M/d")} 上課`
              : `${formatDate(entry.registeredAt, "M/d")} 登記`}
          </span>
        </span>
        <StatusTag tone={payment.tone}>{payment.text}</StatusTag>
      </Link>
    </li>
  );
};

export default TrialRoster;
