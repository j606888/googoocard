/**
 * 收款人的預設（spec §8，跟伺服器的 `defaultReceiver`（service/finance/receiver.ts）同規則）：
 * 自己是保管人 → 自己；否則 → 這堂課分部的負責人（要是保管人）；都不是 → null，讓人自己選。
 * 給前端預選收款人用；伺服器端照樣會再驗一次。
 */
export function defaultReceiverId({
  meId,
  custodianIds,
  keeperUserId,
}: {
  meId: number | undefined;
  custodianIds: readonly number[];
  keeperUserId: number | null | undefined;
}): number | null {
  if (meId !== undefined && custodianIds.includes(meId)) return meId;
  if (keeperUserId != null && custodianIds.includes(keeperUserId)) return keeperUserId;
  return null;
}
