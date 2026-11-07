# 01 · 研究：外面的系統怎麼做、我們少了什麼

> 2026-11-07 研究。來源以官方說明頁為主；標〔第三方〕的是非官方來源。Xero Central 與 Mindbody 說明頁需要 JavaScript，部分只能引用第三方。QuickBooks Test Drive 有 CAPTCHA，這次沒有實際操作截圖；下方「有截圖的頁面」可以用瀏覽器自己看。

---

## 1. 會計軟體（Xero、QuickBooks Online）

| 主題 | 怎麼做 | 對我們的意義 |
|---|---|---|
| 開帳 | Xero：Conversion Balances，轉換日只能是某月 1 號，填前一天的試算表〔第三方〕。QBO：每個帳戶各自選開始日（任何一天），差額進 **Opening Balance Equity**；之後可以改期初分錄 [官方](https://quickbooks.intuit.com/learn-support/en-us/help-articles/edit-an-incorrect-opening-balance/00/262087) | 我們照 QBO：任何一天、差額進「期初權益調整」→ 04 |
| 鎖帳 | Xero：兩個鎖帳日（擋一般人／擋所有人）〔第三方〕。QBO：Close the books，關帳日以前改東西只是**警告或要密碼**，另有「關帳後被改的交易」報表＋Audit Log [官方](https://quickbooks.intuit.com/learn-support/en-us/help-article/close-books/close-books-quickbooks-online/L59LelyPM_US_en_US) | 我們用硬鎖＋自動更正分錄，比 QBO 嚴格，鎖住的數字永遠不變 → 03 §3.5 |
| 分部 | QBO 的 **Location** 可以出分部資產負債表（表頭和明細都帶 Location）；Class 只在明細，AR／AP 會落到「Not Specified」[官方](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/how-does-running-a-balance-sheet-by-class-or-by-location-work/00/239406)。Xero 用 tracking category 篩資產負債表時自動產生「Tracking Transfers」科目讓各類平衡〔第三方〕 | 我們每一行都帶分部、每個分部自平衡，跟 Xero 的 Tracking Transfers 是同一個概念（我們叫分部往來）→ 02 §1.2 |
| 現金與對帳 | 零用金是「現金」類科目；盤點差額轉 over/short [官方](https://quickbooks.intuit.com/ca/resources/bookkeeping/how-to-reconcile-petty-cash/)。對帳要差額 0 才能完成 | 資金帳戶＋盤點＋現金短溢 → 02 §3.7 |
| 首頁 | Xero：各帳戶餘額（帳上 vs 對帳單）、應收（依到期分組）、應付、近 6 個月現金進出、科目觀察清單 [Xero blog](https://blog.xero.com/product-updates/new-xero-homepage/) | 總覽頁的數字與趨勢 → 05 §3.1 |
| 報表 | P&L、Balance Sheet、Cash Flow、Trial Balance、General Ledger、Journal、Transaction Detail by Account、Aged Receivables／Payables [官方](https://quickbooks.intuit.com/learn-support/en-us/help-article/purchase-orders/reports-included-quickbooks-online-subscription/L0s4KrGgr_US_en_US) | 05 §2 的報表清單 |
| 手動分錄、稽核 | Xero 手動分錄可自動迴轉，每張單據有 History & Notes；QBO 有 Audit Log | 手動分錄、沖銷、稽核紀錄 |
| 權益、年結 | QBO 新年度自動把淨利轉入 Retained Earnings；Owner's draw／investment 不自動結清。Xero 不需要結帳分錄 | 公積金＝累積盈餘，報表即時算，不用結帳分錄 → 02 §2 |

## 2. 課程／健身房系統

| 系統 | 重點 |
|---|---|
| Arketa | Deferred Revenue 報表（付款、已用／剩餘、已賺、遞延，可依分館）；Expired Packages 報表；薪資費率可組合底薪、上下限、營收 %、人數級距 [說明](https://help.arketa.com/reporting/sales/package-reports)、[薪資](https://help.arketa.com/team/payroll/setup) |
| bsport | 堂數卡逐堂認列；到期時剩下的一次認列為 breakage [說明](https://intercom.help/bsport-helpcenter/en/articles/15768623-understand-deferred-revenue) |
| Mindbody | Earned Revenue 報表；老師費率可以是營收 %；**不保留歷史費率，改費率連過去報表一起變** [說明](https://support.mindbodyonline.com/s/article/203256593-Pay-Rates-report?language=en_US) |
| Momence、Zingfit、Glofox、TeamUp | 固定、營收 %、級距；Glofox、TeamUp 不做營收拆帳 |
| 「學生付了才付老師」 | **沒有找到任何一套直接支援**。最接近的是 Arketa 排除未付費／招待的預約。法律上對應營造業的 pay-if-paid 條款 |

對我們的意義：
- 預收餘額報表、過期清單、老師報酬單是課程系統的標配 → 05 §3.5、3.8。
- Mindbody 改費率會改到過去，是常見抱怨；我們的分錄只增不改，改規則只影響沒鎖的期間，過去的報酬不會變。
- 「付了才付老師」是我們特有的規則，外面沒有現成做法 → 用「應付老師報酬－待學生付款」科目自己做（02 §3.2）。

## 3. 會計原則與台灣法規

- **商業會計法 §10**：會計基礎採權責發生制；平時用現金制的，決算時要調整為權責制 [全國法規](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=J0080009&flno=10)。§82：小規模合夥或獨資得不適用 [全國法規](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=J0080009&flno=82)。所得稅法 §22：非公司組織可以申報用現金制 [全國法規](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=G0340003&flno=22)。→ 對內管理用權責制（D4），報稅用哪種交給記帳士。
- **IFRS 15**：預收對價列合約負債（項目表叫「預收收入」2222），每上一堂認列；breakage 可以按比例或等到「幾乎不可能再用」時認列。我們採最保守的「到期才認列」，跟 bsport 一樣。
- **總分支機構往來／基金會計**：往來科目成對，合併時互相沖銷；基金是「一組自我平衡的帳戶」（GASB 1300）。→ 分部自平衡（D2）。
- **科目代碼**：經濟部《商業會計項目表》112 年版（1111 庫存現金、1113 銀行存款、1191 應收帳款、2192 應付租金、2222 預收收入、2393 業主往來、3351 累積盈虧、4121 勞務收入、6111 薪資支出、6112 租金支出）。表中沒有「合約負債」。→ 02 §2。

## 4. 差距：feat/finance 少了什麼

| 會計系統該有的 | feat/finance 現況 | v2 |
|---|---|---|
| 科目表 | 沒有，只有「格子」 | 02 §2 |
| 分錄、總帳 | 沒有，每次重算 | 03 §2 |
| 資產負債表（教室／分部） | 只有按人切的保管中 | 05 §3.3 |
| 試算表、總分類帳、drill-down | 沒有 | 05 §3.6 |
| 現金流量 | 沒有 | 05 §3.4 |
| 應收（誰欠我們、逾期多久） | 待處理清單有未付款，沒有帳齡、沒有金額總數 | 05 §3.5 |
| 預收餘額報表（rollforward） | 只在保管中裡的一個數字 | 05 §3.5 |
| 老師報酬單 | 分散在結算單 | 05 §3.8 |
| 對帳／盤點 | 刻意不做 | 05 §3.9 |
| 代墊 vs 教室的錢付 | 都記成「從保管中付」 | 02 §3.5 |
| 業主投入／提取 | 只有「領走自己的」 | 02 §3.6 |
| 鎖帳 | 只能整月、JSON 快照 | 任何一天、分錄不可改 |
| 開帳 | 綁在啟用日，只能做一次 | 任何一天、鎖帳前可重開 |
| 手動分錄／更正 | 沒有 | 02 §3.8 |
| 稽核紀錄 | 有 createdById、voidedAt | 沖銷分錄＋稽核紀錄 |

feat/finance **做對、v2 沿用**的：分帳規則與保底、次數包、成員房東、綁課卡與缺席扣格、贈送卡、6 個月到期、退費、收款人限保管人、只分收到的錢、上線日之前不算、結帳前的「要處理的事」清單。

## 5. 有截圖的頁面（用瀏覽器打開看）

- Xero 新首頁：https://blog.xero.com/product-updates/new-xero-homepage/
- Xero 儀表板：https://www.xero.com/nz/accounting-software/dashboard
- Xero 鎖帳日：https://central.xero.com/s/article/Set-up-and-work-with-lock-dates
- QBO 對帳流程：https://quickbooks.intuit.com/learn-support/en-us/help-article/reconciliation-reports/learn-reconcile-workflow-quickbooks/L8ZibUuVE_US_en_US
- QBO 依 Location 的資產負債表：https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/how-does-running-a-balance-sheet-by-class-or-by-location-work/00/239406
- Arketa 薪資設定：https://help.arketa.com/team/payroll/setup
- 想自己玩：QuickBooks Test Drive（https://qbo.intuit.com/redir/testdrive ，要過一個「我不是機器人」）、Xero 30 天試用的示範公司。
