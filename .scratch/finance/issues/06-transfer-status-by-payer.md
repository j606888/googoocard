# 06 轉帳狀態「等待轉帳／已完成轉帳」，由付款人按

Status: resolved
Type: task
Blocked by: 04

Parent: `.scratch/finance/spec.md`

結算後每筆要轉／要發的錢顯示「等待轉帳」或「已完成轉帳」。按「已完成」的權限：那筆的付款人（保管人），或可以結算的人代按；API 也要擋。記錄按的人與時間。取消已完成照現有流程。不發通知。

## Answer
結算單每筆顯示「等待轉帳／已完成轉帳」＋誰、何時按（`FinanceTransfer.createdById`／`createdAt`）。付款人自己或可以結算的人能按「已完成」；API 由 `assertCanRecordTransfer` 擋（非結算者只能記結算過月份、快照上自己那筆、不超過未轉金額，否則 403 `NOT_PAYER`）。取消照舊只有可以結算的人。
