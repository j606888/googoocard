# 07 修：月結單「月結前保管中」用當時的預收

Status: ready-for-agent
Type: task

`custodyBefore`（`src/service/finance/settlement.ts`）用的是現在的預收；鎖住的月份翻回去看，數字會變。鎖月快照要存當時的預收（以及 `?through` 的預收），已鎖月份從快照讀。見 `docs/roadmap.md`「新版財務」已知缺口。完成後從 roadmap 劃掉這一項。
