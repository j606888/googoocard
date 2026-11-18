"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { FieldLabel } from "@/components/Field";
import Select from "@/components/Select";
import { formatCardSerial } from "@/lib/cardSerial";
import { useUpdateCardBranchesMutation } from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";
import type { SplitNames } from "./useSplitNames";

/** 改一張卡的「錢的分部」與「卡的分部」（已結清的課不會跟著變）。 */
export default function CardBranchDrawer({
  card,
  names,
  onClose,
}: {
  card: { id: number; serialNumber: number | null; studentName: string; moneyLocationId: number | null; homeLocationId?: number | null };
  names: SplitNames;
  onClose: () => void;
}) {
  const [money, setMoney] = useState<number | null>(card.moneyLocationId);
  const [home, setHome] = useState<number | null>(card.homeLocationId ?? card.moneyLocationId);
  const [update, { isLoading }] = useUpdateCardBranchesMutation();
  const options = names.locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <Drawer
      open
      title="卡的分部"
      subtitle={`${card.studentName}${card.serialNumber ? ` · ${formatCardSerial(card.serialNumber)}` : ""}`}
      onClose={onClose}
      isLoading={isLoading}
      disabled={!money || !home}
      submitText="儲存"
      onSubmit={async () => {
        try {
          await update({ id: card.id, moneyLocationId: money, homeLocationId: home }).unwrap();
          toast.success("已更新");
          onClose();
        } catch (e) {
          toast.error(financeErrorText(e));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>錢在哪個分部</FieldLabel>
          <Select aria-label="錢在哪個分部" value={money ?? undefined} placeholder="還沒設" options={options} onChange={setMoney} />
          <p className="text-[13px] text-neutral-500">這張卡的錢在那個分部負責人手上，上課的成本由這個分部分攤。</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>卡屬於哪個分部</FieldLabel>
          <Select aria-label="卡屬於哪個分部" value={home ?? undefined} placeholder="還沒設" options={options} onChange={setHome} />
          <p className="text-[13px] text-neutral-500">卡到期沒用完的錢歸這個分部。</p>
        </div>
      </div>
    </Drawer>
  );
}
