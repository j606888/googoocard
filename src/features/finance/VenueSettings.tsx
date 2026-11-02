"use client";

import { useState } from "react";
import { toast } from "sonner";
import Field from "@/components/Field";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import {
  useCreateFinanceVenueMutation,
  useGetFinancePacksQuery,
  useGetFinanceVenuesQuery,
  useUpdateFinanceVenueMutation,
} from "@/store/slices/finance";
import PackForm from "./PackForm";
import { financeErrorText } from "./financeUi";
import { useFinanceMembers } from "./useFinanceForm";

const NONE = 0;

/** 場地（房東）與次數包。次數包的「還剩幾次」直接買一包、填剩下的次數與價錢。 */
export default function VenueSettings() {
  const { data } = useGetFinanceVenuesQuery();
  const { data: packData } = useGetFinancePacksQuery();
  const { options } = useFinanceMembers();
  const [create, { isLoading }] = useCreateFinanceVenueMutation();
  const [update] = useUpdateFinanceVenueMutation();
  const [name, setName] = useState("");
  const [landlord, setLandlord] = useState(NONE);
  const [packOpen, setPackOpen] = useState(false);
  const venues = data?.venues ?? [];
  const packCount = (venueId: number) =>
    (packData?.packs ?? []).filter((p) => p.venueId === venueId && !p.voidedAt).length;

  return (
    <div className="flex flex-col gap-3">
      {venues.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                {v.name}
                {v.archivedAt && <span className="ml-2 align-middle"><StatusTag tone="neutral">已封存</StatusTag></span>}
              </span>
              <span className="shrink-0 text-[13px] text-neutral-500">{packCount(v.id)} 包</span>
              <div className="w-36 shrink-0">
                <Select
                  size="sm"
                  aria-label={`${v.name} 房東`}
                  value={v.landlordUserId ?? NONE}
                  onChange={async (id) => {
                    try {
                      await update({ id: v.id, landlordUserId: id === NONE ? null : id }).unwrap();
                    } catch (e) {
                      toast.error(financeErrorText(e, "存不了，請再試一次"));
                    }
                  }}
                  options={[{ value: NONE, label: "沒有房東" }, ...options]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="新增場地" value={name} placeholder="場地名稱" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-36 shrink-0">
          <Select
            aria-label="新場地的房東"
            value={landlord}
            onChange={setLandlord}
            options={[{ value: NONE, label: "沒有房東" }, ...options]}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!name.trim() || isLoading}
          onClick={async () => {
            try {
              await create({ name: name.trim(), landlordUserId: landlord === NONE ? null : landlord }).unwrap();
              setName("");
              setLandlord(NONE);
            } catch (e) {
              toast.error(financeErrorText(e, "新增不了，名稱可能重複了"));
            }
          }}
        >
          新增
        </Button>
      </div>
      {venues.some((v) => !v.archivedAt) && (
        <div>
          <Button variant="secondary" onClick={() => setPackOpen(true)}>
            買次數包
          </Button>
          <PackForm open={packOpen} onClose={() => setPackOpen(false)} />
        </div>
      )}
    </div>
  );
}
