# 07 修：月結單「月結前保管中」用當時的預收

Status: resolved
Type: task

`custodyBefore`（`src/service/finance/settlement.ts`）用的是現在的預收；鎖住的月份翻回去看，數字會變。鎖月快照要存當時的預收（以及 `?through` 的預收），已鎖月份從快照讀。見 `docs/roadmap.md`「新版財務」已知缺口。完成後從 roadmap 劃掉這一項。

## Answer

鎖月快照多存一欄 `prepaid`（鎖住當時每位保管人的預收，= 結算單 `custodyBefore` 的預收）；`getCustody(through=已鎖月份)` 改用它，不再用現在的預收。鎖住的結算單本來就整份從快照讀；舊快照沒有這欄就照舊用現況。回歸測試：`tests/api/finance-settlement.test.ts`「custody through a locked month keeps the prepaid from lock time」。
