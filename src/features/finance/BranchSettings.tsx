"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import Link from "next/link";
import { roleLabel } from "@/lib/roles";
import { toast } from "sonner";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import {
  useGetFinanceLocationsQuery,
  useSetMemberFinanceMutation,
  useUpdateFinanceLocationMutation,
  type FinanceLocation,
} from "@/store/slices/finance";
import { useCreateLocationMutation } from "@/store/slices/locations";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const NONE = 0;

function BranchRow({ loc }: { loc: FinanceLocation }) {
  const { options, allMembers } = useFinanceMembers();
  const [update] = useUpdateFinanceLocationMutation();
  const [setMemberFinance] = useSetMemberFinanceMutation();

  // 負責人列全部成員：保管人在前；選了不是保管人的人，先把他設成保管人再指派。
  const memberHint = (m: (typeof allMembers)[number]) =>
    [roleLabel(m.role), m.teacherName && `老師「${m.teacherName}」`].filter(Boolean).join(" · ");
  const keeperOptions = [
    ...allMembers
      .filter((m) => m.isCustodian)
      .map((m) => ({ value: m.userId, label: m.name, hint: memberHint(m), group: "保管人" })),
    ...allMembers
      .filter((m) => !m.isCustodian)
      .map((m) => ({
        value: m.userId,
        label: m.name,
        hint: memberHint(m),
        group: "其他成員（選了會變成保管人）",
      })),
  ];

  const patch = async (body: Parameters<typeof update>[0]) => {
    try {
      await update(body).unwrap();
      return true;
    } catch (e) {
      toast.error(financeErrorText(e, "存不了，請再試一次"));
      return false;
    }
  };

  const pickKeeper = async (v: number) => {
    if (v === NONE) return patch({ id: loc.id, keeperUserId: null });
    const member = allMembers.find((m) => m.userId === v);
    if (member && !member.isCustodian) {
      try {
        await setMemberFinance({ userId: v, isCustodian: true }).unwrap();
      } catch (e) {
        toast.error(financeErrorText(e, "沒辦法把他設成保管人，請再試一次"));
        return;
      }
      if (await patch({ id: loc.id, keeperUserId: v })) {
        toast.success(`已把 ${member.name} 設成保管人，並設為${loc.name}負責人`);
      }
      return;
    }
    await patch({ id: loc.id, keeperUserId: v });
  };

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0">
      <h3 className="text-sm font-semibold text-neutral-900">{loc.name}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">負責人</span>
          <Select
            size="sm"
            aria-label={`${loc.name} 負責人`}
            value={loc.keeperUserId ?? NONE}
            onChange={(v) => void pickKeeper(v)}
            options={[{ value: NONE, label: "還沒設定" }, ...keeperOptions]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">過期的錢給</span>
          <Select
            size="sm"
            aria-label={`${loc.name} 過期收入對象`}
            value={loc.expiryTo === "USER" ? (loc.expiryUserId ?? NONE) : NONE}
            onChange={(v) =>
              patch(
                v === NONE
                  ? { id: loc.id, expiryTo: "FUND", expiryUserId: null }
                  : { id: loc.id, expiryTo: "USER", expiryUserId: v },
              )
            }
            options={[{ value: NONE, label: "這個分部的公積金" }, ...options]}
          />
          <span className="text-xs text-neutral-500">學生的卡過期沒用完，剩下的錢歸誰</span>
        </div>
      </div>
    </li>
  );
}

/** 負責人常被誤會成「權限最大的人」，一句話講清楚它是什麼、名單從哪來。 */
function KeeperHint() {
  return (
    <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
      負責人＝這個分部收的錢最後交給誰。要找的人不在名單裡，先到「教室設定 → 團隊」邀請他。
    </p>
  );
}

function AddBranch() {
  const [create, { isLoading }] = useCreateLocationMutation();
  const [name, setName] = useState("");
  return (
    <div className="mt-3 flex items-end gap-2 border-t border-neutral-100 pt-4">
      <div className="flex-1">
        <Field label="新增分部" value={name} placeholder="分部名稱" onChange={(e) => setName(e.target.value)} />
      </div>
      <Button
        variant="secondary"
        className="h-12"
        disabled={!name.trim() || isLoading}
        onClick={async () => {
          try {
            await create({ name: name.trim() }).unwrap();
            setName("");
          } catch {
            toast.error("新增不了，名稱可能重複了");
          }
        }}
      >
        新增
      </Button>
    </div>
  );
}

export default function BranchSettings() {
  const { data } = useGetFinanceLocationsQuery();
  const locations = data?.locations ?? [];
  // 載入中不要先顯示「還沒有分部」
  if (!data) return <Skeleton className="h-24 w-full rounded-xl" />;
  return (
    <>
      {locations.length === 0 ? (
        <p className="text-sm text-neutral-500">還沒有分部</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {locations.map((l) => (
            <BranchRow key={l.id} loc={l} />
          ))}
        </ul>
      )}
      {locations.length > 0 && <KeeperHint />}
      <AddBranch />
      <Link href="/locations" className="mt-3 inline-flex text-[13px] font-medium text-primary-700 underline-offset-4 hover:underline">
        改名或封存分部
      </Link>
    </>
  );
}
