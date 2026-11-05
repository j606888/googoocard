"use client";

import { toast } from "sonner";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import {
  useConfirmLegacyPrepaidMutation,
  useGetFinanceSettingsQuery,
  useGetFinanceSetupQuery,
  useSetMemberFinanceMutation,
  useUpdateFinanceSettingsMutation,
} from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";

const ROUNDS = [
  { value: 1, label: "1 元" },
  { value: 10, label: "10 元" },
  { value: 100, label: "100 元" },
];

const MEMBER_ERRORS: Record<string, string> = {
  LAST_CUSTODIAN: "至少要留一位保管人",
  LAST_SETTLER: "至少要留一位可以結算的人",
};

const MEMBER_FLAGS = [
  { flag: "isCustodian", label: "保管人" },
  { flag: "canSettle", label: "可以結算" },
] as const;

/** 財務成員（保管人／可以結算）、發錢取整、舊卡保管人與預收確認。 */
export default function GeneralSettings() {
  const { data: settings } = useGetFinanceSettingsQuery();
  const { data: setup } = useGetFinanceSetupQuery();
  const [updateSettings] = useUpdateFinanceSettingsMutation();
  const [setMember] = useSetMemberFinanceMutation();
  const [confirmLegacy, { isLoading: confirming }] = useConfirmLegacyPrepaidMutation();
  const members = settings?.members ?? [];
  const legacy = setup?.items.find((i) => i.key === "legacyPrepaid");

  const save = async (body: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(body).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "存不了，請再試一次"));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold text-neutral-900">
          財務成員
          <InfoTip label="財務成員說明">
            保管人：手上有教室的錢，出現在保管中、可以被選為收款人和分部負責人。可以結算：確認月結、記支出和次數包、改分帳規則與財務設定。
          </InfoTip>
        </h3>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {members.map((m) => (
            <li key={m.userId} className="flex min-h-11 items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              {MEMBER_FLAGS.map(({ flag, label }) => (
                <label key={flag} className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary-700"
                    checked={m[flag]}
                    onChange={async (e) => {
                      try {
                        await setMember({ userId: m.userId, [flag]: e.target.checked }).unwrap();
                      } catch (err) {
                        const code = (err as { data?: { code?: string } })?.data?.code;
                        toast.error((code && MEMBER_ERRORS[code]) || "改不了，請再試一次");
                      }
                    }}
                  />
                  {label}
                </label>
              ))}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 text-sm font-medium text-neutral-900">
            月結取整到
            <InfoTip label="取整說明">
              只有月結發錢時，每個人的月合計取整到這個單位；零頭進付款人負責分部的公積金。
            </InfoTip>
          </span>
          <Select
            aria-label="月結取整"
            value={settings?.roundTo ?? 1}
            onChange={(v) => save({ roundTo: v as 1 | 10 | 100 })}
            options={ROUNDS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">舊卡的錢在誰手上</span>
          <Select
            aria-label="舊卡保管人"
            value={settings?.legacyCustodianUserId ?? undefined}
            onChange={(v) => save({ legacyCustodianUserId: v })}
            options={members.map((m) => ({ value: m.userId, label: m.name }))}
            placeholder="選一位"
          />
        </div>
      </div>

      <div id="legacy" className="rounded-xl border border-neutral-200 p-3">
        <h3 className="text-sm font-semibold text-neutral-900">舊卡預收</h3>
        <p className="mt-1 text-sm text-neutral-700">{legacy?.detail ?? "…"}</p>
        {legacy?.done ? (
          <p className="mt-2 text-[13px] text-primary-900">已確認</p>
        ) : (
          <Button
            className="mt-2"
            variant="secondary"
            disabled={confirming || !legacy}
            onClick={async () => {
              try {
                await confirmLegacy().unwrap();
                toast.success("已確認舊卡預收");
              } catch (e) {
                toast.error(financeErrorText(e, "確認不了，請再試一次"));
              }
            }}
          >
            確認舊卡預收
          </Button>
        )}
      </div>
    </div>
  );
}
