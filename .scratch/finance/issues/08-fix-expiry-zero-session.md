# 08 修：自動過期關掉 0 格的卡

Status: resolved
Type: task

`expireDueCards()`（`src/service/finance/expiry.ts`）也會關掉剩 0 格的卡，可能順手清掉 Needs Renewal tag（`refreshNeedsRenewalTag()`）。0 格的卡不該被當成過期處理。另：沒有分部也沒有舊保管人時，過期事件被靜默略過——至少要出現在 custody warnings／首頁要處理的事。完成後從 roadmap 劃掉。

## Answer

`expireDueCards()` 只關還有剩格的卡（`remainingSessions > 0`），用完的卡不再被關、Needs Renewal 不會被清掉；之後退格回來有剩格了，下次讀取才照常到期。沒有賣卡分部也沒有舊保管人的過期卡改由 `loadExpiries()` 回報，保管中 warnings 出現 `{ code: "UNRESOLVED_KEEPER", studentCardId }`（財務首頁的「有些錢找不到該給誰」）；不擋月結。
