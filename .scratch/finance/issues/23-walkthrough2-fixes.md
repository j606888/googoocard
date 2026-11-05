# 23 staging 第二遍的碎片

Status: resolved
Type: task

1. **小幫手也能連老師帳號**：22.12 的連結提醒與 `POST /api/finance/teachers/[id]/link` 把小幫手排除了，但 Bailamore 的 Sean 角色是小幫手、同時是老師。結果「Sean」老師沒連帳號 → 結算單出現「Sean → Sean $568」。允許連到任何成員（仍不能連到已連其他老師的人）；提醒照樣出現。另外：付款人＝某成員、而該成員就是這位老師（已連帳號）時，ledger 本來就會合併進「自己的」，確認這條也涵蓋 Sean。
2. **瀑布的取整零頭列**：高雄顯示「− 調整 $1」，但「進公積金 $126 − $1」≠「本月 $126」；台南同一列叫「過期收入與調整」。統一名稱為「過期收入與調整」、正負號跟金額走；各列四捨五入後要能對上本月淨變化（顯示層做尾差調整，或 |值| < 0.5 時不顯示該列）。首頁與結算單兩處。
3. **財務首頁「要處理的事」只列上線日之後的課**：台南列出 9/20 小龍「點名沒課卡」（上線前、沒分部的舊課）。財務首頁的待處理只取 `periodStart >= financeEnabledAt 上線日` 的項目（原本的待處理頁不變）。

## Answer

1. `POST /api/finance/teachers/[id]/link` 與 `GET /api/finance/teachers` 的 `linkSuggestion` 不再排除小幫手（仍不能連已連別的老師的人 → 409）。ledger 判「自己的」只看 `Teacher.userId`，跟角色無關——`finance-custody` 測試確認小幫手連帳號後分潤進他自己的。團隊頁 `PATCH /api/memberships/[id]` 對「一直是小幫手」的人保留既有連結（抽屜會送 `teacherId: null`，不然一編輯就默默解除）；老師／管理員改成小幫手照舊解除。
2. `roundWaterfall()`（`src/domains/finance/waterfall.ts`）：各列四捨五入；上半段本來就對得上時進公積金用整數相減；「過期收入與調整」＝ 本月淨變化 − 進公積金 ＋ 支出，吃掉尾差，0 就不顯示。名稱統一「過期收入與調整」，正負號跟金額。`WaterfallRows` 用它，首頁與結算單同一份。
3. `getFinanceHome()` 的未付單堂、點名沒課卡只留 `lessonPeriodStartTime >= financeEnabledAt`；`getTodos()`（待處理頁）不變。未付款課卡沒有時段，照列（欠款上線後收也是上線後的錢）。

