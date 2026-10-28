"use client";

import { useState } from "react";
import { Check, Hammer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel } from "@/components/Field";
import { cn } from "@/lib/utils";
import {
  useSetRevenueOwnerMutation,
  useSetupFinanceMutation,
  type FinanceSettingState,
} from "@/store/slices/finance";
import { Panel, MoneyInput, DateInput } from "../ui";
import { dayLabel, errorText, money, parseMoneyInput, todayKey } from "../format";

const TOTAL = 5;
const QUESTIONS = [
  { title: "誰保管公司的錢？", hint: "營收負責人" },
  { title: "從哪天開始記帳？", hint: "啟用日" },
  { title: "大水庫現在有多少錢？", hint: "期初餘額" },
  { title: "你自己放了多少錢進來？", hint: "選填，可以略過" },
  { title: "現在誰手上還有沒交的錢？", hint: "期初代收，可以略過" },
];

/**
 * 建城 5 題（docs/finance-plan.md §4.3），一題一畫面，最後一頁確認再送。
 * 畫面先用一般介面；奇異鳥小鎮的版本之後疊上去。
 */
export default function SetupWizard({ state, meId }: { state: FinanceSettingState; meId: number }) {
  const saved = state.setting;
  const [step, setStep] = useState(0); // 0 = 任務清單；1–5 = 題目；6 = 確認
  const [ownerId, setOwnerId] = useState<number | null>(saved?.revenueOwnerUserId ?? (state.canEdit ? null : meId));
  const [startDate, setStartDate] = useState(todayKey());
  const [balance, setBalance] = useState("");
  const [loan, setLoan] = useState<string | null>("");
  const [custody, setCustody] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [setRevenueOwner, handOff] = useSetRevenueOwnerMutation();
  const [setup, submit] = useSetupFinanceMutation();

  const owner = state.members.find((m) => m.id === ownerId);
  const others = state.members.filter((m) => m.id !== ownerId);
  const custodyRows = others
    .map((m) => ({ userId: m.id, name: m.name, amount: parseMoneyInput(custody[m.id] ?? "") ?? 0 }))
    .filter((c) => c.amount > 0);
  const handedOff = saved?.revenueOwnerUserId && saved.revenueOwnerUserId !== meId ? state.members.find((m) => m.id === saved.revenueOwnerUserId) : null;

  const next = () => {
    setError(null);
    if (step === 1 && !ownerId) return setError("選一位成員");
    if (step === 2 && !startDate) return setError("選一個日期");
    if (step === 3 && parseMoneyInput(balance) === null) return setError("填一個數字，沒有就填 0");
    if (step === 4 && loan !== null && loan !== "" && parseMoneyInput(loan) === null) return setError("填一個數字，或按「略過這題」");
    setStep((s) => s + 1);
  };

  const finish = async () => {
    try {
      await setup({
        revenueOwnerUserId: ownerId!,
        startDate,
        openingBalance: parseMoneyInput(balance) ?? 0,
        openingOwnerLoan: loan === null || loan === "" ? null : parseMoneyInput(loan),
        openingCustody: custodyRows.map(({ userId, amount }) => ({ userId, amount })),
      }).unwrap();
      toast.success("主堡建好了！");
    } catch (e) {
      toast.error(errorText(e, "建城沒有成功，請再試一次"));
    }
  };

  const handOver = async () => {
    try {
      await setRevenueOwner(ownerId!).unwrap();
      toast.success(`已經交給 ${owner?.name}，他登入後會看到建城任務`);
      setStep(0);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (step === 0) {
    return (
      <Panel className="max-w-[560px]">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-50 text-warning-950">
            <Hammer className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">建城任務</h2>
            <p className="text-[13px] text-neutral-500">5 題，大約 10 分鐘</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-neutral-600">先回答幾個問題，水庫就會開始記帳：從啟用日起，課卡收款、繳回、大水庫的進出都在這裡。</p>
        {handedOff && (
          <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900">
            已經交給 <strong>{handedOff.name}</strong> 建城。你也可以坐在他旁邊一起填。
          </p>
        )}
        <ol className="flex flex-col border-t border-dashed border-neutral-200 pt-2">
          {QUESTIONS.map((q, i) => (
            <li key={q.title} className="flex items-center gap-3 py-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-neutral-300 text-xs font-semibold text-neutral-500">{i + 1}</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900">{q.title}</span>
                <span className="text-[13px] text-neutral-500">{q.hint}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-600">
          先準備：Excel「大水庫結餘」最後的數字、存摺餘額、手上的現金。
        </p>
        <Button size="lg" onClick={() => setStep(1)}>
          開始建城
        </Button>
      </Panel>
    );
  }

  const progress = (
    <div className="flex items-center justify-between text-[13px] font-medium text-neutral-500">
      <span>{step <= TOTAL ? `第 ${step} 題，共 ${TOTAL} 題` : "最後確認"}</span>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={cn("h-1.5 w-6 rounded-full", i < step - 1 || step > TOTAL ? "bg-primary-600" : i === step - 1 ? "bg-warning-300" : "bg-neutral-200")} />
        ))}
      </span>
    </div>
  );
  const nav = (primary: React.ReactNode) => (
    <div className="flex gap-3 pt-1">
      <Button variant="secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>
        上一步
      </Button>
      {primary}
    </div>
  );
  const nextButton = (
    <Button className="flex-1" onClick={next}>
      下一步
    </Button>
  );
  const errorId = "finance-setup-error";

  return (
    <Panel className="max-w-[560px]">
      {progress}
      {step <= TOTAL && <h2 className="text-xl font-bold text-neutral-900">{QUESTIONS[step - 1].title}</h2>}

      {step === 1 && (
        <>
          <p className="text-sm leading-relaxed text-neutral-600">選一位成員當營收負責人。只有他能確認大家送回來的錢、記大水庫的支出，有人送錢來時通知也發給他。</p>
          {state.canEdit ? (
            <div role="radiogroup" aria-label="營收負責人" className="flex flex-col gap-2">
              {state.members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={ownerId === m.id}
                  onClick={() => setOwnerId(m.id)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] px-4 text-left",
                    ownerId === m.id ? "border-primary-700 bg-primary-50" : "border-neutral-300 bg-white"
                  )}
                >
                  <span className={cn("size-5 shrink-0 rounded-full border-2", ownerId === m.id ? "border-[6px] border-primary-700" : "border-neutral-300")} />
                  <span className="flex-1 text-sm font-semibold text-neutral-900">{m.name}{m.id === meId && "（我）"}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900">營收負責人是你。要換人請管理員到水庫設定換。</p>
          )}
          <FieldError id={errorId}>{error}</FieldError>
          {state.canEdit && ownerId && ownerId !== meId && (
            <p className="text-[13px] leading-relaxed text-neutral-500">
              可以交給 {owner?.name} 自己填後面 4 題，或你現在幫他填完。
            </p>
          )}
          {nav(
            <>
              {state.canEdit && ownerId && ownerId !== meId && (
                <Button variant="secondary" className="flex-1" onClick={handOver} isLoading={handOff.isLoading}>
                  交給 {owner?.name}
                </Button>
              )}
              {nextButton}
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm leading-relaxed text-neutral-600">預設今天。這天之後的課卡收款、支出都記在這裡；之前的留在 Excel，這天之前付款的課卡不算代收。</p>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="start-date">啟用日</FieldLabel>
            <DateInput id="start-date" value={startDate} max={todayKey()} onChange={setStartDate} />
          </div>
          <FieldError id={errorId}>{error}</FieldError>
          {nav(nextButton)}
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-sm leading-relaxed text-neutral-600">
            {dayLabel(`${startDate}T12:00:00+08:00`)}這天，公司的錢有多少——現金加銀行，一個數就好。
          </p>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="opening-balance">現金＋銀行</FieldLabel>
            <MoneyInput id="opening-balance" value={balance} onChange={setBalance} autoFocus error={!!error} ariaDescribedBy={errorId} />
          </div>
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-600">
            可以先抄 Excel「大水庫結餘」最後的累計數，再跟存摺、手上的現金對一下。學生已經付、還沒上的堂數不用另外填，系統會從課卡算。
          </p>
          <FieldError id={errorId}>{error}</FieldError>
          {nav(nextButton)}
        </>
      )}

      {step === 4 && (
        <>
          <p className="text-sm leading-relaxed text-neutral-600">
            選填。{owner?.name ?? "老闆"}前期投入、自己掏錢補的，都算借給公司——只記帳、不排還款，讓大家看得到回本進度。略過的話不顯示建城貸款，之後可以在設定補。
          </p>
          {loan === null ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">已略過</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="opening-loan">放進來的錢</FieldLabel>
              <MoneyInput id="opening-loan" value={loan} onChange={setLoan} autoFocus error={!!error} ariaDescribedBy={errorId} />
            </div>
          )}
          <FieldError id={errorId}>{error}</FieldError>
          {nav(
            <>
              <Button variant="secondary" onClick={() => { setLoan(null); setError(null); setStep(5); }}>
                略過這題
              </Button>
              {nextButton}
            </>
          )}
        </>
      )}

      {step === 5 && (
        <>
          <p className="text-sm leading-relaxed text-neutral-600">
            啟用日之前收的、還沒交給{owner?.name ?? "營收負責人"}的課卡錢，每人一個數。沒有就空著。
          </p>
          <div className="flex flex-col gap-3">
            {others.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <label htmlFor={`custody-${m.id}`} className="w-24 shrink-0 truncate text-sm font-semibold text-neutral-900">
                  {m.name}
                </label>
                <div className="flex-1">
                  <MoneyInput id={`custody-${m.id}`} value={custody[m.id] ?? ""} onChange={(v) => setCustody((c) => ({ ...c, [m.id]: v }))} />
                </div>
              </div>
            ))}
          </div>
          {nav(nextButton)}
        </>
      )}

      {step === TOTAL + 1 && (
        <>
          <h2 className="text-xl font-bold text-neutral-900">確認一下</h2>
          <dl className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {[
              ["營收負責人", owner?.name ?? "—", 1],
              ["啟用日", dayLabel(`${startDate}T12:00:00+08:00`), 2],
              ["大水庫現在有", money(parseMoneyInput(balance) ?? 0), 3],
              ["建城貸款（欠老闆的）", loan === null || loan === "" ? "略過" : money(parseMoneyInput(loan) ?? 0), 4],
              ["期初代收", custodyRows.length ? custodyRows.map((c) => `${c.name} ${money(c.amount)}`).join("、") : "沒有", 5],
            ].map(([label, value, s]) => (
              <div key={label as string} className="flex items-center gap-3 px-4 py-3">
                <dt className="w-36 shrink-0 text-[13px] text-neutral-500">{label}</dt>
                <dd className="flex-1 text-sm font-semibold text-neutral-900">{value}</dd>
                <Button variant="link" size="sm" onClick={() => setStep(s as number)}>
                  改
                </Button>
              </div>
            ))}
          </dl>
          <p className="text-[13px] leading-relaxed text-neutral-500">建好之後數字還能改，但要寫原因、留紀錄。第一筆繳回確認之前，可以重新開帳。</p>
          {nav(
            <Button className="flex-1" onClick={finish} isLoading={submit.isLoading}>
              <Check className="size-4" aria-hidden="true" />
              建城
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
