"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";

/**
 * 試玩推車：一筆假的繳回，練習按一次「收到了」。不寫進帳裡，只標記任務完成。
 */
export default function TrialDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [result, setResult] = useState<"confirmed" | "rejected" | null>(null);

  const close = () => {
    setResult(null);
    onClose();
  };

  return (
    <ResponsiveDialog open={open} onClose={close} className="min-h-0 gap-4 p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">試玩一次：有人送錢來了</ResponsiveDialogTitle>
      <div className="flex items-center gap-2">
        <StatusTag tone="outline">練習</StatusTag>
        <span className="text-[13px] text-neutral-500">不會記進帳裡</span>
      </div>
      {result === null ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-warning-50 text-warning-950">
              <Truck className="size-5" />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-base font-bold text-neutral-900">丁丁送來 $1,000</span>
              <span className="text-[13px] text-neutral-500">現金 · 剛剛 · 等你確認</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-neutral-600">
            之後每次有人送錢來，手機會響，打開就是這張。錢真的拿到了按「收到了」；金額對不上按「金額不對」，寫原因退回去。
          </p>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => { setResult("confirmed"); onDone(); }}>
              收到了
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => { setResult("rejected"); onDone(); }}>
              金額不對
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="rounded-2xl bg-primary-50 px-4 py-4 text-sm leading-relaxed text-primary-900">
            {result === "confirmed"
              ? "就是這樣！真的時候，$1,000 會進大水庫，丁丁也會收到「錢收到了」的通知。"
              : "就是這樣！真的時候會請你寫原因，丁丁收到通知、改好再送一次。"}
          </p>
          <Button onClick={close}>知道了</Button>
        </>
      )}
    </ResponsiveDialog>
  );
}
