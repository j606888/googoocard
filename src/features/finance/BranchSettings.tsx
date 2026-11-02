"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Field from "@/components/Field";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import {
  useConfirmFundOpeningMutation,
  useGetFinanceLocationsQuery,
  useUpdateFinanceLocationMutation,
  type FinanceLocation,
} from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const NONE = 0;

function BranchRow({ loc }: { loc: FinanceLocation }) {
  const { options } = useFinanceMembers();
  const [update] = useUpdateFinanceLocationMutation();
  const [confirm, { isLoading }] = useConfirmFundOpeningMutation();
  const [opening, setOpening] = useState(String(loc.fundOpening));
  const openingNum = Number(opening);
  const valid = opening.trim() !== "" && Number.isInteger(openingNum);

  const patch = async (body: Parameters<typeof update>[0]) => {
    try {
      await update(body).unwrap();
    } catch (e) {
      toast.error(financeErrorText(e, "存不了，請再試一次"));
    }
  };

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{loc.name}</h3>
        {loc.fundOpeningConfirmedAt ? (
          <StatusTag tone="positive">期初已確認</StatusTag>
        ) : (
          <StatusTag tone="warning">期初未確認</StatusTag>
        )}
      </div>
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
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="公積金期初"
            inputMode="numeric"
            value={opening}
            onChange={(e) => setOpening(e.target.value.replace(/[^\d-]/g, ""))}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!valid || isLoading}
          onClick={async () => {
            try {
              await confirm({ id: loc.id, fundOpening: openingNum }).unwrap();
              toast.success(`已確認 ${loc.name} 的期初`);
            } catch (e) {
              toast.error(financeErrorText(e, "確認不了，請再試一次"));
            }
          }}
        >
          確認期初
        </Button>
      </div>
    </li>
  );
}

export default function BranchSettings() {
  const { data } = useGetFinanceLocationsQuery();
  const locations = data?.locations ?? [];
  return (
    <>
      <p className="mb-1 flex items-center gap-1 text-sm text-neutral-600">
        <Link href="/locations" className="text-primary-700 underline-offset-4 hover:underline">
          新增或改名分部
        </Link>
        <InfoTip label="公積金期初說明">
          期初可以從 0 開始，或填負責人認定的數字。不要直接搬 Excel 的水庫結餘，裡面混了預付場租和還沒進帳的學費。
        </InfoTip>
      </p>
      {locations.length === 0 ? (
        <p className="text-sm text-neutral-500">還沒有分部</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {locations.map((l) => (
            <BranchRow key={`${l.id}-${l.fundOpening}`} loc={l} />
          ))}
        </ul>
      )}
    </>
  );
}
