# 09 修：有贈送卡的綁課卡刪不掉

Status: ready-for-agent
Type: task

`StudentCard.giftFromId` 指回綁課卡（`@unique`），刪綁課卡時被擋。刪綁課卡時：贈送卡沒用過就一起刪；用過了就擋下並說明原因。走 `src/app/api/students/[id]/student-cards/[studentCardId]/route.ts`。完成後從 roadmap 劃掉。
