-- 舊的 8 張預設頭像（/images/avatar_N.png）不是自己的圖，2026-10 換成奇異鳥頭像
-- （scripts/generate-avatars.mjs）。還在用舊預設圖的學生一律改成「Not Sure」，
-- 由老師再挑。自己上傳的頭像（Cloudinary 網址）不動。
-- `/avatars/avatar-*` 是更早期的路徑，網站上早就沒有這些檔案了，一起換掉。
UPDATE "Student"
SET "avatarUrl" = '/images/avatars/not-sure.png'
WHERE "avatarUrl" ~ '^/images/avatar_[0-9]+\.png$'
   OR "avatarUrl" LIKE '/avatars/avatar-%';
