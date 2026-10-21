-- 舊的 8 張預設頭像（/images/avatar_N.png）不是自己的圖，2026-10 換成奇異鳥頭像
-- （scripts/generate-avatars.mjs）。自己上傳的頭像（Cloudinary 網址）不動。

-- HustleHustle 教室用舊頭像分男女：大象（avatar_1）= 男、狐狸（avatar_3）= 女。
-- 依使用者決定（2026-10-21）換成 Leader／Follower；例外由老師自己改。
-- 用教室名稱比對，因為寫這段時拿不到正式站的教室 id。
UPDATE "Student" AS s
SET "avatarUrl" = '/images/avatars/leader.png'
FROM "Classroom" AS c
WHERE s."classroomId" = c."id"
  AND c."name" ILIKE 'HustleHus%'
  AND s."avatarUrl" = '/images/avatar_1.png';

UPDATE "Student" AS s
SET "avatarUrl" = '/images/avatars/follower.png'
FROM "Classroom" AS c
WHERE s."classroomId" = c."id"
  AND c."name" ILIKE 'HustleHus%'
  AND s."avatarUrl" = '/images/avatar_3.png';

-- 其他還在用舊預設圖的學生一律改成「Not Sure」，由老師再挑。
-- `/avatars/avatar-*` 是更早期的路徑，網站上早就沒有這些檔案了，一起換掉。
UPDATE "Student"
SET "avatarUrl" = '/images/avatars/not-sure.png'
WHERE "avatarUrl" ~ '^/images/avatar_[0-9]+\.png$'
   OR "avatarUrl" LIKE '/avatars/avatar-%';
