-- 團隊與老師合併（2026-11）：每個成員在教室裡都有一筆人員資料（Teacher.userId 連到他）。
-- 還沒有的補建：名字取帳號名字，身分照角色——小幫手 → ASSISTANT、老師 → TEACHER、管理員 → NONE（不上課）。
-- 代表色照 TEACHER_COLOR_ORDER（src/lib/teachers.ts）輪流給，接在教室現有人數後面。
INSERT INTO "Teacher" ("name", "color", "classroomId", "userId", "kind", "createdAt", "updatedAt")
SELECT
  u."name",
  (ARRAY['blue','orange','purple','teal','pink','indigo','red','green','slate','stone'])[
    -- 接在這間教室現有的人後面輪，才不會跟已經有的老師撞色。
    ((ROW_NUMBER() OVER (PARTITION BY m."classroomId" ORDER BY m."id") - 1
      + (SELECT COUNT(*) FROM "Teacher" x WHERE x."classroomId" = m."classroomId" AND x."archivedAt" IS NULL)
     ) % 10) + 1
  ],
  m."classroomId",
  m."userId",
  CASE m."role"
    WHEN 'assistant' THEN 'ASSISTANT'::"TeacherKind"
    WHEN 'teacher' THEN 'TEACHER'::"TeacherKind"
    ELSE 'NONE'::"TeacherKind"
  END,
  NOW(),
  NOW()
FROM "Membership" m
JOIN "User" u ON u."id" = m."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "Teacher" t WHERE t."classroomId" = m."classroomId" AND t."userId" = m."userId"
);
