// 產生官方帳號的 Rich Menu 圖（2500×1686，3×2 格）：
//   node scripts/generate-richmenu.mjs
// 輸出 public/images/richmenu/main.png（provision 腳本上傳它，/dev/line 模擬器也顯示它）。
// 格子位置與文字來自 src/lib/lineRichMenu.json；改圖就改這裡再重跑，不要手動編輯 PNG。
// 圖示是 lucide（網站用的同一套），字型用系統的 PingFang TC（macOS）。
import { readFileSync, mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const MENU = JSON.parse(readFileSync("src/lib/lineRichMenu.json", "utf8"));
const OUT = "public/images/richmenu/main.png";

// globals.css --color-primary-*
const C = { bg: "#F1FAF6", tile: "#FFFFFF", line: "#D5EEE4", brand: "#2B8E6E", dark: "#1B5E4A", soft: "#E3F7F0" };

// area.action → lucide icon file. The first area (上課簽到) is the highlighted tile.
const ICONS = {
  "liff:checkin": "scan-line",
  "postback:mycards": "wallet-cards",
  "postback:schedule": "calendar-days",
  "postback:prices": "receipt-text",
  "liff:buy": "shopping-bag",
  "postback:more": "ellipsis",
};

async function iconNode(name) {
  const mod = await import(`lucide-react/dist/esm/icons/${name}.js`);
  return mod.__iconNode;
}

const attrs = (o) =>
  Object.entries(o)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");

const GAP = 28; // space between tiles
const RADIUS = 56;

async function tile(area, highlighted) {
  const { x, y, width, height } = area.bounds;
  const tx = x + GAP / 2;
  const ty = y + GAP / 2;
  const tw = width - GAP;
  const th = height - GAP;
  const cx = tx + tw / 2;
  const fill = highlighted ? C.brand : C.tile;
  const fg = highlighted ? "#FFFFFF" : C.dark;
  const circle = highlighted ? "rgba(255,255,255,0.18)" : C.soft;
  const iconColor = highlighted ? "#FFFFFF" : C.brand;

  const ICON = 190; // rendered icon size (lucide is a 24-unit grid)
  const circleR = 170;
  const circleCy = ty + th * 0.40;
  const node = await iconNode(ICONS[area.action]);
  const icon = node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join("");
  return `
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${RADIUS}" fill="${fill}" ${highlighted ? "" : `stroke="${C.line}" stroke-width="4"`}/>
    <circle cx="${cx}" cy="${circleCy}" r="${circleR}" fill="${circle}"/>
    <g transform="translate(${cx - ICON / 2} ${circleCy - ICON / 2}) scale(${ICON / 24})"
       fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
    <text x="${cx}" y="${ty + th * 0.80}" text-anchor="middle" fill="${fg}"
          font-family="PingFang TC, Heiti TC, sans-serif" font-weight="600" font-size="118">${area.label}</text>`;
}

const { width, height } = MENU.size;
const tiles = await Promise.all(MENU.areas.map((area, i) => tile(area, i === 0)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${C.bg}"/>
  ${tiles.join("")}
</svg>`;

mkdirSync("public/images/richmenu", { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(OUT);
const kb = Math.round(statSync(OUT).size / 1024);
console.log(`${OUT} ${width}×${height} ${kb} KB`);
if (kb > 1024) throw new Error("LINE rejects rich menu images over 1 MB");
