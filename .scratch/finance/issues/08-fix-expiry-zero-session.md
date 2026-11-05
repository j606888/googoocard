# 08 修：自動過期關掉 0 格的卡

Status: ready-for-agent
Type: task

`expireDueCards()`（`src/service/finance/expiry.ts`）也會關掉剩 0 格的卡，可能順手清掉 Needs Renewal tag（`refreshNeedsRenewalTag()`）。0 格的卡不該被當成過期處理。另：沒有分部也沒有舊保管人時，過期事件被靜默略過——至少要出現在 custody warnings／首頁要處理的事。完成後從 roadmap 劃掉。
