-- 「不上課」：團隊裡只管事、不教課也不當小幫手的人（多半是管理員）。
-- 自己一個 migration：新的 enum 值要等這個 migration 結束才能在下一個裡使用。
ALTER TYPE "TeacherKind" ADD VALUE IF NOT EXISTS 'NONE';
