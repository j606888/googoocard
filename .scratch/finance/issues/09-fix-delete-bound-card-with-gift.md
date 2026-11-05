# 09 修：有贈送卡的綁課卡刪不掉

Status: resolved
Type: task

`StudentCard.giftFromId` 指回綁課卡（`@unique`），刪綁課卡時被擋。刪綁課卡時：贈送卡沒用過就一起刪；用過了就擋下並說明原因。走 `src/app/api/students/[id]/student-cards/[studentCardId]/route.ts`。完成後從 roadmap 劃掉。

## Answer

刪綁課卡時：贈送卡沒用過（沒出席、沒缺席扣格、沒轉換／轉讓）→ 同一個交易裡一起刪；用過了 → 400 `GIFT_USED`「這張卡附送的贈送卡已經用過，不能刪除；請改用「停用」」，課卡詳情的刪除失敗提示會顯示這句。綁課卡本身的既有規則（用過、在轉換／轉讓鏈上就不能刪）不變。
