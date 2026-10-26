"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Money, { EXPENSE_TEXT, moneyText } from "../Money";
import { mainPool, period } from "../mockData";
import { financeHref } from "../routes";
import type { BranchPool } from "../types";
import { LabeledControl, LaterAction, NeedsEditNotice, OptionCard, Panel, PanelTitle } from "../ui";
import { remittable } from "./poolMath";

type Method = "transfer" | "cash" | "offset";

/** 繳回大水庫（轉帳／現金／抵薪）。示意：送出只改畫面。 */
export default function RemitForm({
  pool,
  keeperPayout,
  canEdit,
}: {
  pool: BranchPool;
  /** 保管人這個月的分潤（抵薪時用） */
  keeperPayout: number;
  canEdit: boolean;
}) {
  const id = useId();
  const suggested = remittable(pool);
  const [amountText, setAmountText] = useState(String(suggested));
  const [method, setMethod] = useState<Method>("transfer");
  const [sent, setSent] = useState(false);

  const amount = Number(amountText) || 0;
  const left = pool.balance - amount;
  const tooMuch = amount > pool.balance;
  const invalid = amount <= 0 || tooMuch;
  const locked = sent || !canEdit;

  const methods: { id: Method; label: string; hint: string }[] = [
    { id: "transfer", label: "銀行轉帳", hint: "附截圖或末五碼" },
    { id: "cash", label: `現金交給${mainPool.accountant}`, hint: "見面時直接交" },
    { id: "offset", label: "抵扣分潤", hint: "月結時才能用" },
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid || locked) return;
    setSent(true);
    toast.success("（示意）已送出繳回");
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <Panel className="p-4 lg:p-7">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] sm:gap-3">
            <div className="rounded-xl bg-primary-50 px-4 py-3.5">
              <div className="text-[13px] text-primary-900">從</div>
              <div className="text-base font-bold text-neutral-900">{pool.name}</div>
              <div className="text-[13px] text-neutral-600">
                餘額 <Money value={pool.balance} />
              </div>
            </div>
            <div aria-hidden="true" className="flex justify-center text-primary-700">
              <ArrowDown className="size-5 sm:hidden" />
              <ArrowRight className="hidden size-5 sm:block" />
            </div>
            <div className="rounded-xl bg-primary-900 px-4 py-3.5 text-white">
              <div className="text-[13px] text-primary-100">到</div>
              <div className="text-base font-bold">大水庫</div>
              <div className="text-[13px] text-primary-100">
                {mainPool.account} · {mainPool.accountant}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${id}-amount`}>繳回金額</FieldLabel>
            <div className={cn(fieldControlClass(tooMuch), "flex h-16 items-center gap-2", locked && "bg-neutral-50")}>
              <span className="text-base text-neutral-500">NT$</span>
              <input
                id={`${id}-amount`}
                type="number"
                inputMode="numeric"
                min={0}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                disabled={locked}
                aria-invalid={tooMuch || undefined}
                aria-describedby={`${id}-hint`}
                className="w-full min-w-0 bg-transparent text-3xl font-semibold tabular-nums text-neutral-900 outline-none disabled:text-neutral-600"
              />
            </div>
            <p id={`${id}-hint`} className="text-[13px] text-neutral-500">
              建議 <Money value={suggested} /> ＝ 餘額 <Money value={pool.balance} /> − 保留零用金 <Money value={pool.reserve} /> ·
              繳回後小水庫剩 <Money value={left} className="font-bold text-neutral-900" />
            </p>
            <FieldError>{tooMuch ? "超過小水庫餘額了" : undefined}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">怎麼繳回</span>
            <div role="group" aria-label="繳回方式" className="grid gap-2.5 sm:grid-cols-3">
              {methods.map((m) => (
                <OptionCard
                  key={m.id}
                  selected={m.id === method}
                  title={m.label}
                  hint={m.hint}
                  disabled={locked}
                  onSelect={() => setMethod(m.id)}
                />
              ))}
            </div>
          </div>

          {method === "transfer" && (
            <div className="flex flex-col gap-3.5">
              <LabeledControl label="轉出帳號末五碼" htmlFor={`${id}-ref`} className="max-w-[220px]">
                <input
                  id={`${id}-ref`}
                  inputMode="numeric"
                  maxLength={5}
                  defaultValue="38211"
                  disabled={locked}
                  className={cn(fieldControlClass(), "h-12 tabular-nums")}
                />
              </LabeledControl>
              <LaterAction className="w-full [&>button]:flex-1">
                <Upload className="size-4" />
                上傳轉帳截圖
              </LaterAction>
            </div>
          )}

          {method === "cash" && (
            <LabeledControl
              label="交給誰"
              htmlFor={`${id}-to`}
              hint="對方在系統按「確認收到」才算完成，不用另外簽收單。"
              className="max-w-[320px]"
            >
              <select id={`${id}-to`} disabled={locked} className={cn(fieldControlClass(), "h-12")}>
                <option>{mainPool.accountant}</option>
                <option>{mainPool.owner}</option>
              </select>
            </LabeledControl>
          )}

          {method === "offset" && (
            <div className="flex flex-col gap-2.5 rounded-xl bg-neutral-50 px-4 py-4 text-[15px] text-neutral-900">
              <div className="flex justify-between gap-3">
                <span>
                  {pool.keeper} {period.monthName}分潤
                </span>
                <Money value={keeperPayout} />
              </div>
              <div className="flex justify-between gap-3">
                <span>這次抵扣（手上的錢直接當薪水）</span>
                <Money value={-amount} className={EXPENSE_TEXT} />
              </div>
              <div className="flex justify-between gap-3 border-t border-neutral-200 pt-2.5 font-bold">
                <span>月結時大水庫只要再轉給{pool.keeper}</span>
                <Money value={Math.max(0, keeperPayout - amount)} className="text-primary-900" />
              </div>
              {amount > keeperPayout && (
                <div className={cn("text-[13px]", EXPENSE_TEXT)}>
                  抵扣超過分潤，多出的 {moneyText(amount - keeperPayout)} 還是要另外繳回。
                </div>
              )}
              <div className="text-[13px] text-neutral-500">
                只能在月結發薪時使用；系統會在{pool.keeper}的薪資單上列出這筆抵扣。
              </div>
            </div>
          )}

          <LabeledControl label={<>備註<span className="ml-1 font-normal text-neutral-500">（選填）</span></>} htmlFor={`${id}-note`}>
            <input
              id={`${id}-note`}
              placeholder="例：含萬聖節門票"
              disabled={locked}
              className={cn(fieldControlClass(), "h-12")}
            />
          </LabeledControl>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {!canEdit && <NeedsEditNotice action="送出繳回" className="mr-auto" />}
            <Button variant="secondary" asChild>
              <Link href={financeHref("pool", pool.id)}>{sent ? "回小水庫" : "取消"}</Link>
            </Button>
            {canEdit && (
              <Button type="submit" disabled={invalid || sent}>
                {sent ? "已送出" : "送出繳回"}
              </Button>
            )}
          </div>
        </form>
      </Panel>

      <aside aria-label="繳回進度" className="flex flex-col gap-4">
        <Panel className="p-4 lg:p-6">
          <PanelTitle className="mb-3">接下來會發生什麼</PanelTitle>
          <ol className="flex flex-col">
            <TimelineStep
              index={1}
              done={sent}
              current={!sent}
              title={`${pool.keeper}送出`}
              note={
                sent
                  ? `剛剛送出 · 等${mainPool.accountant}確認（示意，不會真的送出）`
                  : `按「送出繳回」後，${mainPool.accountant}會收到通知`
              }
            />
            <TimelineStep index={2} current={sent} title="轉帳中" note="小水庫先扣掉，大水庫還沒加上，總覽會單獨顯示這筆" />
            <TimelineStep
              index={3}
              title={`${mainPool.accountant}確認收到`}
              note="錢進大水庫；金額不符會退回說明"
              last
            />
          </ol>
        </Panel>

        <section className="flex flex-col gap-2.5 rounded-2xl bg-primary-900 px-5 py-5 text-white lg:px-6">
          <h3 className="mb-1 text-base font-bold">繳回後</h3>
          <div className="flex justify-between gap-3 text-[15px]">
            <span className="text-primary-100">{pool.name}</span>
            <Money value={left} />
          </div>
          <div className="flex justify-between gap-3 text-[15px]">
            <span className="text-primary-100">轉帳中</span>
            <Money value={amount} sign className="text-warning-300" />
          </div>
          <div className="flex justify-between gap-3 border-t border-white/20 pt-2.5 text-[15px]">
            <span className="text-primary-100">教室總資金</span>
            <span className="font-bold">不變</span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function TimelineStep({
  index,
  title,
  note,
  done = false,
  current = false,
  last = false,
}: {
  index: number;
  title: string;
  note: string;
  done?: boolean;
  current?: boolean;
  last?: boolean;
}) {
  return (
    <li aria-current={current ? "step" : undefined} className={cn("grid grid-cols-[28px_minmax(0,1fr)] gap-3", !last && "pb-4")}>
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
          done
            ? "bg-primary-900 text-white"
            : current
              ? "border-[1.5px] border-primary-700 bg-primary-50 font-bold text-primary-900"
              : "bg-neutral-100 text-neutral-600"
        )}
      >
        {done ? "✓" : index}
      </span>
      <div>
        <div className="text-[15px] font-medium text-neutral-900">{title}</div>
        <div className="text-[13px] text-neutral-500">{note}</div>
      </div>
    </li>
  );
}
