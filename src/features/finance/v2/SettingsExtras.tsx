"use client";

// 財務設定上的 v2 區塊：開帳狀態、手動分錄清單（沖銷）。
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useGetJournalQuery, useGetOpeningQuery, useReverseJournalEntryMutation, type JournalEntryView } from "@/store/slices/ledger";
import { financeErrorText } from "../financeUi";
import { Amount } from "./ui";

export function OpeningCard() {
  const { data } = useGetOpeningQuery();
  if (!data) return null;
  return (
    <Link href="/finance/opening" className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 hover:border-neutral-300">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-neutral-900">開帳</span>
        <span className="text-[13px] text-neutral-500">
          {data.opened
            ? `從 ${data.conversionDate?.replaceAll("-", "/")} 開帳${data.lockDate ? ` · 已鎖到 ${data.lockDate.replaceAll("-", "/")}` : " · 鎖帳前可以重開"}`
            : "還沒開帳"}
        </span>
      </span>
      <ChevronRight className="size-4 text-neutral-500" />
    </Link>
  );
}

export function JournalList() {
  const { data } = useGetJournalQuery();
  const entries = (data?.entries ?? []).filter((e) => e.kind !== "OPENING");
  if (entries.length === 0) return <p className="text-sm text-neutral-500">還沒有手動分錄</p>;
  return (
    <div className="flex flex-col">
      {entries.map((e) => <Entry key={e.id} e={e} />)}
    </div>
  );
}

function Entry({ e }: { e: JournalEntryView }) {
  const [reverse, { isLoading }] = useReverseJournalEntryMutation();
  const [confirm, setConfirm] = useState(false);
  const debit = e.lines.reduce((s, l) => s + Math.max(0, l.amount), 0);
  return (
    <div className="flex flex-col gap-1.5 border-t border-neutral-100 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular-nums text-neutral-500">{e.date.replaceAll("-", "/")}</span>
        <span className="flex-1 font-medium">{e.kind === "REVERSAL" ? "沖銷　" : ""}{e.memo}</span>
        <Amount cents={debit} />
        {e.kind === "MANUAL" && !e.reversedById && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>沖銷</Button>
        )}
        {e.reversedById && <span className="text-xs text-neutral-500">已沖銷</span>}
      </div>
      <div className="flex flex-col gap-0.5 pl-1 text-[13px] text-neutral-600">
        {e.lines.filter((l) => l.code !== "1990").map((l, i) => (
          <span key={i} className="flex gap-2">
            <span className="w-6 text-neutral-500">{l.amount > 0 ? "借" : "貸"}</span>
            <span className="flex-1">{l.code} {l.accountName}</span>
            <Amount cents={Math.abs(l.amount)} />
          </span>
        ))}
      </div>
      <ConfirmDialog
        open={confirm}
        title="沖銷這筆分錄？"
        message="會記一筆完全相反的分錄（今天），原本這筆留著。"
        confirmLabel="沖銷"
        variant="danger"
        isLoading={isLoading}
        onConfirm={() =>
          reverse({ id: e.id })
            .unwrap()
            .then(() => {
              toast.success("已沖銷");
              setConfirm(false);
            })
            .catch((err) => {
              toast.error(financeErrorText(err));
              setConfirm(false);
            })
        }
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
