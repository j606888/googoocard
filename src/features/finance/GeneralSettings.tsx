"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import {
  useGetFinanceSettingsQuery,
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

/** 財務成員（保管人／可以結算）、發錢取整、舊卡的錢在誰手上。 */
export default function GeneralSettings() {
  const { data: settings } = useGetFinanceSettingsQuery();
  const [updateSettings] = useUpdateFinanceSettingsMutation();
  const [setMember] = useSetMemberFinanceMutation();
  const members = settings?.members ?? [];

  // 載入中不要先顯示空的成員和「…」
  const loading = !settings;

  const save = async (body: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(body).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "存不了，請再試一次"));
    }
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold text-neutral-900">
          財務成員
          <InfoTip label="財務成員說明">
            保管人：手上有教室的錢，有自己的資金帳戶，可以收款、當分部負責人。可以結算：建付款批次、記任何人的支出、手動分錄、鎖帳、改分帳規則與財務設定。
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
                        const data = (err as { data?: { code?: string; error?: string } })?.data;
                        const code = data?.code;
                        // CUSTODIAN_IN_USE 的訊息會列出他還負責哪些（伺服器組好的中文）
                        const text = code === "CUSTODIAN_IN_USE" ? data?.error : code && MEMBER_ERRORS[code];
                        toast.error(text || "改不了，請再試一次");
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
            發錢取整到
            <InfoTip label="取整說明">
              付款批次每筆付款取整到這個單位，零頭記成尾差。
            </InfoTip>
          </span>
          <Select
            aria-label="發錢取整"
            value={settings?.roundTo ?? 1}
            onChange={(v) => save({ roundTo: v as 1 | 10 | 100 })}
            options={ROUNDS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">舊卡的錢在誰手上</span>
          <span className="text-xs text-neutral-500">開財務之前賣的卡，錢當時是誰收的（開帳時設一次）</span>
          <Select
            aria-label="舊卡保管人"
            value={settings?.legacyCustodianUserId ?? undefined}
            onChange={(v) => save({ legacyCustodianUserId: v })}
            options={members.filter((m) => m.isCustodian).map((m) => ({ value: m.userId, label: m.name }))}
            placeholder="選一位"
          />
        </div>
      </div>

    </div>
  );
}
