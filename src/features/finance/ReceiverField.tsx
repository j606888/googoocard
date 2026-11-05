"use client";

import { useState } from "react";
import Select from "@/components/Select";
import InfoTip from "@/components/InfoTip";
import { FieldLabel } from "@/components/Field";
import { defaultReceiverId } from "@/domains/finance/receiverDefault";
import { useGetFinanceLocationsQuery, useGetFinanceSettingsQuery } from "@/store/slices/finance";
import { useGetMeQuery } from "@/store/slices/me";

/**
 * 收款時「錢記在誰手上」（財務開啟才有）：預設照 spec §8（自己是保管人就是自己，
 * 否則是這堂課分部的負責人），可改成另一位保管人；都沒有就要自己選。
 * `active` = 表單打開了才去抓資料；`lessonLocationId` = 這堂課的分部（沒有就只看自己）。
 */
export function useFinanceReceiver({
  active,
  lessonLocationId,
}: {
  active: boolean;
  lessonLocationId?: number | null;
}) {
  const { data: finance } = useGetFinanceSettingsQuery(undefined, { skip: !active });
  const financeOn = !!finance?.enabled;
  const { data: me } = useGetMeQuery(undefined, { skip: !active || !financeOn });
  const { data: locationsData } = useGetFinanceLocationsQuery(undefined, {
    skip: !active || !financeOn || !lessonLocationId,
  });
  const [picked, setPicked] = useState<number | null>(null);

  const custodians = (finance?.members ?? []).filter((m) => m.isCustodian);
  const keeperUserId = lessonLocationId
    ? locationsData?.locations.find((l) => l.id === lessonLocationId)?.keeperUserId
    : null;
  const fallback = defaultReceiverId({
    meId: me?.id,
    custodianIds: custodians.map((m) => m.userId),
    keeperUserId,
  });

  return {
    financeOn,
    /** 財務開啟時要送的收款人；null = 還沒選（送出要擋）。 */
    receiverUserId: financeOn ? (picked ?? fallback) : null,
    setReceiverUserId: setPicked,
    reset: () => setPicked(null),
    options: custodians.map((m) => ({
      value: m.userId,
      label: m.userId === me?.id ? `${m.name}（我）` : m.name,
    })),
  };
}

export default function ReceiverField({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: number | null;
  onChange: (userId: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={id}>收款人</FieldLabel>
        <InfoTip label="收款人說明">
          錢現在在誰手上。只能選保管人；學生把錢交給（或轉到）另一位保管人就改選那位。
        </InfoTip>
      </div>
      <Select
        id={id}
        value={value ?? undefined}
        onChange={onChange}
        placeholder="選收款人"
        options={options}
      />
    </div>
  );
}
