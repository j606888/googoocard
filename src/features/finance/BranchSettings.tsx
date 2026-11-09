"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import {
  useGetFinanceLocationsQuery,
  useUpdateFinanceLocationMutation,
  type FinanceLocation,
} from "@/store/slices/finance";
import { useCreateLocationMutation } from "@/store/slices/locations";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const NONE = 0;

function BranchRow({ loc }: { loc: FinanceLocation }) {
  const { options } = useFinanceMembers();
  const [update] = useUpdateFinanceLocationMutation();

  const patch = async (body: Parameters<typeof update>[0]) => {
    try {
      await update(body).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "存不了，請再試一次"));
    }
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
            onChange={(v) => patch({ id: loc.id, keeperUserId: v === NONE ? null : v })}
            options={[{ value: NONE, label: "還沒設定" }, ...options]}
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

/** 負責人／過期的錢只能選保管人，常被誤會成「權限最大的兩個人」，所以講清楚、給一條去設定保管人的路。 */
function KeeperHint() {
  return (
    <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
      只列出保管人（可以收錢的人）。
      <a
        href="/finance/settings#general"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-1 font-medium text-primary-700 underline-offset-4 hover:underline"
      >
        沒看到要的人？
      </a>
      <br />
      還不在團隊裡的人，要先到「教室設定 → 團隊」邀請。
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
