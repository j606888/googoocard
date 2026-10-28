"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fieldControlClass } from "@/components/Field";
import Select, { textOptions } from "@/components/Select";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import FinancePageHeader from "../FinancePageHeader";
import { moneyText } from "../Money";
import { branchSettings, mainPool } from "../mockData";
import { financeHref } from "../routes";
import type { BranchFundMode, BranchSetting, MainPoolPosition } from "../types";
import { LabeledControl, LaterAction, NeedsEditNotice, OptionCard, Panel } from "../ui";

const MODE_OPTIONS: { id: BranchFundMode; label: string; hint: string }[] = [
  { id: "pool", label: "設小水庫，定期繳回", hint: "由保管人收齊，再繳回大水庫" },
  { id: "direct", label: "直接歸大水庫", hint: "負責人就是大水庫，不用繳回" },
];

/** 據點設定：各據點的資金模式、保管人、零用金、提醒門檻；大水庫的錢放在哪。 */
export default function BranchSettings() {
  const canEdit = useCan("finance.edit");

  return (
    <div className="flex max-w-[1040px] flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        crumbs={[{ label: "資金與繳回", href: financeHref("funds") }]}
        title="據點設定"
        description="每個據點收到的錢放哪裡、誰保管、留多少零用金"
        actions={
          canEdit && (
            <LaterAction>
              <Plus className="size-4" />
              新增據點
            </LaterAction>
          )
        }
      />
      <BranchSettingsForm
        settings={branchSettings}
        owner={mainPool.owner}
        positions={mainPool.positions}
        canEdit={canEdit}
      />
    </div>
  );
}

function BranchSettingsForm({
  settings,
  owner,
  positions,
  canEdit,
}: {
  settings: BranchSetting[];
  owner: string;
  positions: MainPoolPosition[];
  canEdit: boolean;
}) {
  const id = useId();
  const [modes, setModes] = useState<Record<string, BranchFundMode>>(
    Object.fromEntries(settings.map((s) => [s.branch, s.mode]))
  );
  const [splitCash, setSplitCash] = useState(true);
  const control = cn(fieldControlClass(), "h-12");

  const save = (e: FormEvent) => {
    e.preventDefault();
    toast.success("（示意）設定已儲存");
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5 lg:gap-6">
      <fieldset disabled={!canEdit} className="contents">
        {settings.map((s) => {
          const mode = modes[s.branch];
          return (
            <Panel key={s.branch} className="flex flex-col gap-4 p-4 lg:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-neutral-900">{s.branch}</h3>
                <span className="text-[13px] text-neutral-500">{s.collectors} 位老師在這裡收錢</span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-900">錢收在哪裡</span>
                <div role="group" aria-label={`${s.branch}的資金模式`} className="grid gap-2.5 sm:grid-cols-2">
                  {MODE_OPTIONS.map((o) => (
                    <OptionCard
                      key={o.id}
                      selected={o.id === mode}
                      title={o.label}
                      hint={o.hint}
                      disabled={!canEdit}
                      onSelect={() => setModes((m) => ({ ...m, [s.branch]: o.id }))}
                    />
                  ))}
                </div>
              </div>

              {mode === "pool" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <LabeledControl label="保管人" htmlFor={`${id}-${s.branch}-keeper`}>
                    <Select
                      id={`${id}-${s.branch}-keeper`}
                      defaultValue={s.keeperOptions[0]}
                      options={textOptions(s.keeperOptions)}
                    />
                  </LabeledControl>
                  <LabeledControl label="保留零用金" htmlFor={`${id}-${s.branch}-reserve`}>
                    <input
                      id={`${id}-${s.branch}-reserve`}
                      inputMode="numeric"
                      defaultValue={moneyText(s.reserve)}
                      className={cn(control, "tabular-nums")}
                    />
                  </LabeledControl>
                  <LabeledControl label="超過多少提醒繳回" htmlFor={`${id}-${s.branch}-threshold`}>
                    <input
                      id={`${id}-${s.branch}-threshold`}
                      inputMode="numeric"
                      defaultValue={moneyText(s.threshold)}
                      className={cn(control, "tabular-nums")}
                    />
                  </LabeledControl>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <LabeledControl label="現場收到的錢交給" htmlFor={`${id}-${s.branch}-to`} className="max-w-[320px]">
                    <Select
                      id={`${id}-${s.branch}-to`}
                      defaultValue={owner}
                      options={[{ value: owner, label: `${owner}（大水庫）` }]}
                    />
                  </LabeledControl>
                  <div className="rounded-xl bg-neutral-50 px-4 py-3.5 text-sm leading-7 text-neutral-700">
                    {owner}自己收的錢：記帳時就算在大水庫，<b>不用任何動作</b>。
                    <br />
                    其他老師收的錢：交給{owner}後，{owner}按「確認收到」。
                  </div>
                </div>
              )}
            </Panel>
          );
        })}

        <Panel className="flex flex-col gap-3.5 p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">大水庫裡的錢放在哪</h3>
              <p className="mt-1 text-[13px] text-neutral-500">分開記才知道銀行裡實際有多少；不分也不影響任何數字</p>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2.5 text-[15px] text-neutral-900">
              <input
                type="checkbox"
                checked={splitCash}
                onChange={(e) => setSplitCash(e.target.checked)}
                className="size-5 accent-primary-900"
              />
              現金和銀行分開記
            </label>
          </div>
          {splitCash ? (
            <div className="flex flex-col">
              {positions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-t border-neutral-100 py-3">
                  <span className="text-[15px] text-neutral-900">{p.name}</span>
                  {p.note && <span className="text-[13px] text-neutral-500">{p.note}</span>}
                </div>
              ))}
              {canEdit && (
                <LaterAction variant="ghost" size="sm" className="mt-2 self-start">
                  <Plus className="size-4" />
                  新增位置
                </LaterAction>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-neutral-50 px-4 py-3.5 text-sm text-neutral-700">
              大水庫只顯示一個總數，各據點直接歸大水庫的現金都算進去。
            </div>
          )}
        </Panel>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {canEdit ? (
          <Button type="submit" size="lg">
            儲存設定
          </Button>
        ) : (
          <NeedsEditNotice action="修改據點設定" />
        )}
      </div>
    </form>
  );
}
