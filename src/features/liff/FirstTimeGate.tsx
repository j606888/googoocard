"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Lock, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

export interface FirstTimePrefill {
  classroomName: string;
  lineName: string;
  linePicture: string | null;
}

/**
 * On-site QR, and this LINE account has no student in the classroom yet
 * (設計稿 B1 → B2). 「第一次來」registers with just a nickname; 「我來上過課」
 * deliberately has no self-claim from the roster (anyone could claim anyone) —
 * a 小幫手 binds them from the student's page instead.
 */
export default function FirstTimeGate({
  prefill,
  idToken,
  checkinKey,
  onRegistered,
}: {
  prefill: FirstTimePrefill;
  idToken: string;
  checkinKey: string;
  onRegistered: () => void;
}) {
  const [step, setStep] = useState<"ask" | "name" | "returning">("ask");
  const [name, setName] = useState(prefill.lineName.slice(0, 30));
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ key: checkinKey, name: name.trim() }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      onRegistered();
    } catch (err) {
      console.error("[liff] register error", err);
      toast.error("登記失敗，請稍後再試或找小幫手");
      setSubmitting(false);
    }
  };

  const avatar = prefill.linePicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={prefill.linePicture} alt="" className="h-20 w-20 rounded-full object-cover" />
  ) : (
    <div className="h-20 w-20 rounded-full bg-neutral-200" />
  );

  const header = (
    <div className="flex items-center gap-2 px-5 pt-5 text-sm">
      {step !== "ask" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="返回"
          onClick={() => setStep("ask")}
          className="-ml-3"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <span className="font-medium text-neutral-800">{prefill.classroomName}</span>
    </div>
  );

  if (step === "name") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!submitting) handleRegister();
        }}
        className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50"
      >
        {header}
        <div className="flex flex-1 flex-col gap-6 px-5 py-6">
          <div className="flex flex-col items-center gap-2">
            {avatar}
            {prefill.linePicture && <p className="text-xs text-neutral-500">使用你的 LINE 頭像</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="liff-nickname">大家要怎麼叫你？</FieldLabel>
            <input
              id="liff-nickname"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              aria-describedby="liff-nickname-hint"
              className={cn(fieldControlClass(), "h-12")}
              placeholder="暱稱或中文名"
            />
            <p id="liff-nickname-hint" className="text-[13px] text-neutral-500">
              已先帶入你的 LINE 名稱，可以改成暱稱或中文名
            </p>
          </div>
          <div className="flex gap-2.5 rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
            以後打開 LINE 選單就能報到、看剩幾堂、買課卡，不用註冊帳號密碼。
          </div>
        </div>
        <div className="px-5 pb-6">
          <Button type="submit" size="lg" disabled={!name.trim()} isLoading={submitting} className="w-full">
            {submitting ? "登記中…" : "下一步：選今天的課"}
          </Button>
        </div>
      </form>
    );
  }

  if (step === "returning") {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Users className="h-10 w-10 text-primary-700" />
          <h2 className="text-xl font-semibold">請找小幫手幫你綁定 LINE</h2>
          <p className="leading-relaxed text-neutral-600">
            小幫手會在你的學生資料打開綁定 QR Code，用 LINE 掃一下就好，之後就能自己報到。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50">
      {header}
      <div className="flex flex-1 flex-col gap-6 px-5 py-8">
        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          {avatar}
          <h1 className="text-2xl font-bold">{prefill.lineName ? `嗨，${prefill.lineName}` : "嗨"}</h1>
          <p className="leading-relaxed text-neutral-600">
            這個 LINE 還沒有在這間教室登記過。
            <br />
            你是第一次來上課嗎？
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setStep("name")}
            className="flex items-center gap-3.5 rounded-2xl border-2 border-primary-700 bg-white p-4 text-left active:bg-primary-50"
          >
            <UserPlus className="h-6 w-6 shrink-0 text-primary-700" />
            <span className="flex-1">
              <span className="block text-lg font-bold">是，第一次來</span>
              <span className="block text-sm text-neutral-600">填個暱稱就能報到</span>
            </span>
            <ChevronRight className="h-5 w-5 text-primary-700" />
          </button>
          <button
            type="button"
            onClick={() => setStep("returning")}
            className="flex items-center gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50"
          >
            <Users className="h-6 w-6 shrink-0 text-neutral-600" />
            <span className="flex-1">
              <span className="block text-lg font-bold">我來上過課</span>
              <span className="block text-sm text-neutral-600">請小幫手幫你綁定 LINE</span>
            </span>
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
