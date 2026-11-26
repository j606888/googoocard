-- 「需續約」的規則改了（2026-11-26，src/service/studentTag.ts）：手上沒有任何能用的卡、
-- 也不在整期報名期間才算。tag 是事件觸發維護的，舊規則留下來的要清一次：
-- 手上還有能用的卡，或還在整期報名期間的學生，拿掉「Needs Renewal」。
-- 只刪不加——舊規則比新規則寬，不會有人該有卻沒有。
DELETE FROM "StudentTag" st
USING "Tag" t
WHERE st."tagId" = t."id"
  AND t."name" = 'Needs Renewal'
  AND (
    EXISTS (
      SELECT 1 FROM "StudentCard" sc
      WHERE sc."studentId" = st."studentId"
        AND sc."expiredAt" IS NULL
        AND sc."remainingSessions" > 0
    )
    OR EXISTS (
      SELECT 1 FROM "LessonEnrollment" le
      JOIN "Lesson" l ON l."id" = le."lessonId"
      WHERE le."studentId" = st."studentId"
        AND l."status" = 'inProgress'
    )
  );
