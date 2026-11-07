# 06 · 分階段實作計畫

> 讀者：之後每個實作 session。每一階段可以獨立開一個 session 做，做完跑測試、更新這份的勾選。
> 分支：從 `feat/finance` 開 `feat/finance-v2`（feat/finance 的營運面程式要沿用）。不上 production 直到 P7。

規則：
- 開工前讀 [`README.md`](README.md)、[`02`](02-accounting-model.md)、[`03`](03-architecture.md)；動到開帳讀 [`04`](04-opening-and-cutover.md)；動到畫面讀 [`05`](05-screens-and-reports.md) 與設計稿。
- 依 CLAUDE.md：`npm run db:migrate`，絕不 `db push`／`migrate reset`。
- 每階段結束：`npm test` 全綠、`npm run lint`、在 `.scratch/finance-v2/issues/` 對應 ticket 寫 `Status:`。

---

## P0 · 定稿（human）
- [x] 丁丁讀 README，回覆「要你決定的事」（2026-11-07）。
- [x] feat/finance 不先合併。
- 產出：README 的決策表更新為「定案」。

## P1 · 帳本核心（純函式＋schema，無畫面）✅ 2026-11-07
> 完成：migration `ledger_core`；`src/domains/ledger/{money,accounts,lines}.ts`＋`ledger.test.ts`；`src/service/ledger/setup.ts`（`ensureLedgerSetup`，啟用財務與設分部負責人時呼叫）＋`tests/api/ledger-setup.test.ts`。科目表程式名稱為 `LedgerAccount`。
- `Account`、`MoneyAccount`、`JournalEntry`、`JournalLine`、`PostingSource`、`Classroom.financeConversionDate`／`financeLockDate`。
- 科目表種子（02 §2），啟用財務時建立；每個保管人建一個預設資金帳戶（現金，分部＝他負責的分部）。
- `src/domains/ledger/`：`balanceByBranch`、`diffLines`、金額（分）工具、卡的每格價值分配（最後一格吃尾差）。
- 驗收：單元測試涵蓋借貸平衡、分部往來補行、diff 冪等、尾差分配加總等於實收。

## P2 · 過帳器 ✅ 2026-11-07
> 完成：`src/domains/ledger/post/{card,period,cash,types}.ts`（純函式＋`card.test.ts`）、`src/service/ledger/{load,sync,check}.ts`、`POST /api/finance/ledger/sync`、`GET /api/finance/ledger/check`、migration `posting_source_error`、`tests/api/ledger-november.test.ts`（十一月情境 7 案）。改採整批同步，不逐條標 dirty（03 §3.4）。FinanceTransfer（已轉）延到 P5 跟付款表一起過帳。
> 本機 Bailamore 副本試跑：沒有不平衡的分錄；19 筆 `NO_MONEY_ACCOUNT`（本機分部都還沒設負責人），交給 P3 開帳精靈處理。
- 每個 sourceType 的 `desiredLines*` 純函式（03 §3.1），先 CARD、PERIOD、DROP_IN，再 EXPENSE、REFUND、VENUE_PACK，最後 PAYOUT／MONEY_TRANSFER／OWNER_TXN／CASH_COUNT。
- `syncSource`、`markFinanceDirty`、`flushFinance`、`resyncAll`、鎖帳日落點。
- 所有寫入路徑加 dirty 標記（清單：`createStudentCardInTx`、確認收款、改價、轉換、轉讓、到期 `expireDueCards`、作廢、刪卡、點名 `reconcileAndFinalize`、LIFF 自助簽到、綁課卡缺席、單堂新增／改金額／收款、合併學員、分帳規則／單堂覆寫、分部設定、老師付款人、場地與次數包、支出、退費）。用 `grep` 對照 `src/service/finance/*` 現在的觸發點，不要漏。
- `checkLedger()`：02 §5 恆等式。
- 驗收：
  - spec §14 十一月情境做成整合測試：每位老師可發金額、各分部毛利，跟 `computeSplit` 逐分相等；分部往來＝台南欠高雄 333.33（小明在高雄上的那格；舊版的 700 還包含 Sean 的老師份，那是付款時才產生的往來，見 P5）。
  - 鎖帳後補點名 → 更正分錄落在鎖帳日＋1。
  - 隨機事件序列後 `checkLedger` 全綠。

## P3 · 開帳精靈（any-date）✅ 2026-11-07（後端）
> 完成：`src/domains/ledger/opening.ts`（`computeOpening`、`deferredAtConversion`）、`src/service/ledger/opening.ts`（預覽／開帳／重開）、`GET|POST /api/finance/opening`、`POST /api/finance/opening/preview`、`GET|POST /api/finance/money-accounts`、migration `finance_opening`（`Classroom.financeOpenedAt`／`financeOpening`）、`tests/api/ledger-opening.test.ts`。畫面留到 P6。
> 規則補充：轉換日前買的次數包＝轉換日當天還剩的（開帳時記成預付場地），次數包從轉換日起扣（`resolvePackUnitPrices` 改從轉換日起算）。收過錢、但沒有資金帳戶的人會擋住開帳（`OPENING_INCOMPLETE`），要先讓他成為保管人並建資金帳戶。
> 已知缺口：轉換日前的單堂若在轉換日後才收款，不會記收款（單堂少見，先不處理）。
> 本機 Bailamore 副本試算（約定法、10/1）：舊卡 62 張、預收約 $57,622；分部都還沒設負責人，所以 5 位收款人沒有資金帳戶。
- 04 §3 的五步、約定／實數兩種、預覽、試算某一天、第一次鎖帳前可重開。
- feat/finance `setup.ts` 開帳清單前半（分部、課標分部、老師、場地、規則）沿用，接上後半。
- 驗收：用本機正式資料副本（`local-from-prod.sh`）以約定法開帳，期初資產負債表平衡、預收 ＝ 舊卡剩餘價值總和（2026-10-30 副本約 $71,422，以實際為準）。

## P4 · 報表（API＋最陽春的表格畫面）✅ 2026-11-07
> 完成：`src/domains/ledger/reports.ts`（損益、資產負債、現金流量、預收 rollforward、對象餘額／帳齡、每堂獲利、總分類帳、試算表）、`src/service/ledger/reports.ts`（先過帳再算；對象名稱）、`GET /api/finance/reports/[name]`（金額單位「分」）、`/finance/reports`＋`/finance/reports/[name]` 陽春表格、`tests/api/ledger-reports.test.ts`（十一月情境 9 案）、共用情境 `tests/ledgerScenario.ts`。
> 畫面只做到能看數字（沒有在瀏覽器實際點過；P6 依設計稿重做）。財務首頁、導覽還沒接到新報表。
- 試算表、總分類帳、損益表、資產負債表、現金流量、預收餘額 rollforward、應收帳齡、應付明細、課程獲利（05 §3.2–3.6）。
- 全部從 `JournalLine` 查；分部、期間參數一致。
- 驗收：每張表加總與 `checkLedger` 一致；資產負債表平衡；drill-down 到來源。

## P5 · 付款批次、資金帳戶、結帳 ✅ 2026-11-08（後端）
> 完成：migration `finance_payouts_close`＋`money_transfer_settle_amount`（`PayoutRun`／`Payout`／`MoneyTransfer`／`OwnerTransaction`／`CashCount`／`FinanceLockLog`／`FinanceCloseSignoff`；`FinanceExpense.moneyAccountId`／`isAdvance`）、純函式 `src/domains/ledger/post/settle.ts`（付款、轉帳、業主、盤點、取整、往來轉平）、服務 `src/service/ledger/{guard,payouts,records,close}.ts`、API `payouts`、`money-transfers`、`owner-transactions`、`cash-counts`、`journal`、`lock`、`close`（皆在 `/api/finance/` 下，金額單位「分」）、`tests/api/ledger-payouts.test.ts`（9 案）＋`settle.test.ts`。
> 規則補充：
> - 誰付：收錢的人自己有資金帳戶 → 自己領（Sean 台南那份也從他高雄的帳戶出，因此多出 366.66 的往來）；否則老師的付款人；否則應付所在分部負責人的帳戶。
> - 往來轉平的轉帳也取整：`MoneyTransfer.settleAmount`＝清掉的往來（699.99），`amount`＝實際轉的（700），差額兩個分部各記尾差。
> - 實際數字比 spec 少 1 分（L2 每格 333.33 × 2 ＝ 666.66，不是 666.67），取整後丁丁 $5,050、Sean −$2,127 不變。
> - 已付款的付款／轉帳／業主交易／盤點只能作廢（帳本記更正，鎖帳期間的落在鎖帳日隔天）；手動分錄只能沖銷一次；系統分錄不能沖銷（改來源）。
> - 鎖帳要先開帳、不能鎖未來；往後推＝可以結算的人，往前／解鎖＝owner；重開帳不刪手動分錄。
> - 舊的 `FinanceTransfer`（已轉）不過帳，P7 跟舊畫面一起移除。報表 UI、記一筆抽屜、結帳頁留到 P6。
- `PayoutRun`／`Payout`、往來轉平建議、取整尾差、付款人按已付款。
- 資金帳戶頁、盤點。
- 結帳清單、鎖帳／解鎖（owner）、稽核紀錄。
- 記一筆：支出（含代墊）、轉帳、業主交易、手動分錄、沖銷。
- 驗收：十一月情境走完付款後，應付老師、應付場地、分部往來皆為 0；資金帳戶餘額 ＝ spec §14.6 的「轉完之後」（丁丁 $5,050、Sean −$2,127；現金只看收付，跟舊版應該相同）。分部資產負債表：台南 現金 5,050＋應收 2,000（阿傑）＝ 預收 7,066.67（含阿傑剩 5 格）＋待學生付款 222.22（丁丁、Charlene 各 111.11）＋公積金 −238.89（舊版 −350 再加上阿傑那格已認列的 111.11）；高雄 現金 −2,127＋預付場地 3,645 ＝ 預收 1,666.67＋公積金約 −148.67。

## P6 · 設計稿 → 畫面
> 2026-11-08 設計稿第一版：https://claude.ai/artifact/HS4rYcg7kpaAw1tLqsSqN3 （10 張：總覽、損益表、資產負債表、付款批次、老師報酬單（手機）、記一筆抽屜、資金帳戶與盤點、結帳、開帳最後一步、手機總覽；數字取自十一月情境）。丁丁確認照做（2026-11-08）。
> 畫面完成（2026-11-08）：`src/features/finance/v2/`（`ui.tsx` 外框＋金額、`Overview`、`Reports`、`Payouts`、`TeacherStatement`、`RecordDrawer`、`Accounts`、`Close`、`Opening`、`SettingsExtras`），頁面 `/finance`、`/finance/reports[/name]`、`/finance/payouts[/teachers/[id]]`、`/finance/accounts`、`/finance/close`、`/finance/opening`，`/finance/settings` 套上新外框並加開帳與手動分錄清單。新 API：`GET /api/finance/overview`、`GET /api/finance/statements/teachers/[id]`、`GET /api/finance/ledger/accounts`；支出 API 加 `moneyAccountId`／`isAdvance`（代墊）並檢查鎖帳日。`tests/api/ledger-overview.test.ts`。
> 本機瀏覽器看過：總覽、損益表、記一筆、開帳精靈、結帳都正常顯示（本機 Bailamore 還沒開帳，數字不完整）。
> 未做：損益表「期間並排」、記一筆裡的「買次數包」（仍在場地設定）、舊頁面（`/finance/settle`、`/finance/expenses`、`/finance/report`、`FinanceHome`）沒有入口了，P7 刪除。
- 先做設計稿（05 §6 清單），丁丁確認後再刻畫面。總覽、報表、付款、記一筆、開帳、結帳。

## P7 · 收尾與上線
- 移除 feat/finance 的 `custody.ts`、`settlement.ts`、`branchReview.ts`、`domains/finance/ledger.ts`、對應 API 與畫面、`FinanceSettlement`／`FinanceBranchReview`／`FinanceTransfer` 表、`legacyCustodianUserId`。
- 重新整理 finance migrations（04 §7）。
- 更新 `docs/architecture.md`「財務」、`docs/roadmap.md`「新版財務」、`CLAUDE.md` Core Domain Model 的財務段落。
- staging 走一遍（用 Sean 的角度）→ 跟 Sean 開帳 → 合併 → `npm run db:deploy` → 上線。

## P8 · 老師記帳（下一階段）
05 §5：報帳單、我的報酬、老師當保管人、依角色可見度。另開 grilling。
