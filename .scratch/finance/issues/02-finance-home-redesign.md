# 02 財務首頁重做

Status: resolved
Type: task

Parent: `.scratch/finance/spec.md`（「財務首頁」一節）

現況 `src/features/finance/FinanceHome.tsx` 是每位保管人的保管中卡片。改成：
1. **要處理的事**：重用 `getTodos()`（`src/service/todos.ts`）的 unpaidCards／unpaidDropIns／unboundRecords（同一份資料、同一個處理動作，別另做一份），加上財務項目：沒設分帳的課、過去沒點名的時段、次數包用完、上月未結算。依目前選的分部過濾。空的就整區不渲染。
2. **本月瀑布**：收入 → 老師 → 場地 → 進公積金 → 支出 → 本月淨變化；收入只算已實現。可點進每堂課分帳。
3. 分部切換（台南／高雄／全教室），預設＝目前使用者負責的分部（`Location.keeperUserId`），沒有則全教室；月份切換。

驗收：手機與桌機（遵守 `docs/ui-responsive.md`）；瀑布的「本月淨變化」＝該分部公積金當月變化（要有測試對 spec §14 的數字）。

另見 spec「週日課」：分部瀑布依「這堂課的基金」歸類，不依上課地點。

## Answer
首頁改成分部／月份切換＋「要處理的事」（`GET /api/finance/home`：三類直接取自 `getTodos()`、與鈴鐺共用 `UrgentTodoSections`，加上沒設分帳／過去沒點名／次數包用完／上月未結算）＋本月收支瀑布（`monthWaterfall`，依這堂課的基金歸類，淨變化＝結算單的公積金變化）。
測試：`src/domains/finance/waterfall.test.ts`、`tests/api/finance-home.test.ts`（spec §14：台南 −350、高雄 −148.83＋取整零頭）。未付款課卡與次數包沒有分部，每個分部都顯示；「我的分部還沒核對」等核對功能做好再加。
