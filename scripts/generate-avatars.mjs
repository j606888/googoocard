// 產生學生的預設頭像（奇異鳥 × 動作，2026-10 設計稿 F1、品牌配色）：
//   node scripts/generate-avatars.mjs
// 輸出 public/images/avatars/*.png。改圖就改這裡再重跑，不要手動編輯 PNG。
// 奇異鳥的形狀來自 public/kiwi-bird.svg（網站自己的 logo）。
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const SIZE = 384;
const OUT = "public/images/avatars";
const KIWI = readFileSync("public/kiwi-bird.svg", "utf8").match(/ d="([^"]+)"/)[1];
const FG = "#FFFFFF";

const kiwi = (transform) => `<path transform="${transform}" fill="${FG}" d="${KIWI}"/>`;

const AVATARS = {
  // 往前衝：身體前傾，後面有速度線
  leader: {
    bg: "#2B8E6E",
    body: `<path d="M16 50 H28 M12 61 H26 M18 72 H28" stroke="${FG}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      <g transform="rotate(-10 55 55)">${kiwi("translate(24 30) scale(1.2)")}</g>`,
  },
  // 轉圈圈：腳下一圈旋轉弧線、兩顆小星星
  follower: {
    bg: "#D9644C",
    body: `${kiwi("translate(26 30) scale(1.1)")}
      <path d="M20 90 A40 9 0 0 0 100 88 M100 88 L97 79 M100 88 L91 87" stroke="${FG}" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.8"/>
      <path d="M24 22 L26 28 L32 30 L26 32 L24 38 L22 32 L16 30 L22 28 Z M96 28 L97 32 L101 33 L97 34 L96 38 L95 34 L91 33 L95 32 Z" fill="${FG}" opacity="0.75"/>`,
  },
  // 兩隻面對面，中間一顆愛心
  both: {
    bg: "#7559C9",
    body: `${kiwi("translate(8 44) scale(0.82)")}${kiwi("translate(112 44) scale(-0.82 0.82)")}
      <path d="M60 40 C54 34 50 40 54 44 L60 50 L66 44 C70 40 66 34 60 40 Z" fill="${FG}" opacity="0.8"/>`,
  },
  // 歪頭想：旁邊一個「?」想法泡泡
  "not-sure": {
    bg: "#C98A1E",
    body: `<g transform="rotate(8 46 62)">${kiwi("translate(14 40) scale(1.1)")}</g>
      <circle cx="76" cy="40" r="3" fill="${FG}"/><circle cx="83" cy="32" r="4.5" fill="${FG}"/><circle cx="96" cy="21" r="13" fill="${FG}"/>
      <path d="M92 17.5 Q92 13 96 13 Q100 13 100 17 Q100 20 97.5 21.3 Q96 22 96 24.5" stroke="#C98A1E" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="96" cy="28.8" r="1.7" fill="#C98A1E"/>`,
  },
  // 戴耳麥、掛名牌（線條是「挖空」成底色）
  staff: {
    bg: "#4F6478",
    body: `${kiwi("translate(18 30) scale(1.2)")}
      <path d="M58 47 A12 12 0 0 1 80 42" stroke="#4F6478" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <circle cx="58" cy="50" r="4.5" fill="#4F6478"/>
      <path d="M58 54 Q60 62 67 61" stroke="#4F6478" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M36 38 L39 53 M48 36 L45 53" stroke="#4F6478" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="35" y="52" width="14" height="16" rx="2.5" fill="#4F6478"/>`,
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, { bg, body }] of Object.entries(AVATARS)) {
  // 方形滿版底色：前端會自己裁成圓形（object-cover + rounded-full）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${SIZE}" height="${SIZE}"><rect width="120" height="120" fill="${bg}"/>${body}</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
  console.log(`${OUT}/${name}.png`);
}
