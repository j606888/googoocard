// 產生官方帳號的 Rich Menu 圖（2500×1686，左邊一大格＋右邊 2×2）：
//   node scripts/generate-richmenu.mjs
// 輸出 public/images/richmenu/main.png（provision 腳本上傳它，/dev/line 模擬器也顯示它）。
// 格子位置、文字、圖示來自 src/lib/lineRichMenu.json；改圖就改那裡再重跑，不要手動編輯 PNG。
// 圖示是 lucide（網站用的同一套），字型用系統的 PingFang TC（macOS）。
import { readFileSync, mkdirSync, statSync } from "node:fs";
import sharp from "sharp";

const DEF = JSON.parse(readFileSync("src/lib/lineRichMenu.json", "utf8"));
const { width: W, height: H } = DEF.size;

// globals.css --color-primary-*
const C = { bg: "#EEF8F3", tile: "#FFFFFF", line: "#D3EEE3", brand: "#2B8E6E", dark: "#1B5E4A", soft: "#E3F7F0" };
const FONT = "PingFang TC, Heiti TC, sans-serif";

async function iconSvg(name, { x, y, size, color, strokeWidth = 2 }) {
  const mod = await import(`lucide-react/dist/esm/icons/${name}.js`);
  const attrs = (o) =>
    Object.entries(o)
      .filter(([k]) => k !== "key")
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
  const body = mod.__iconNode.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join("");
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}"
    stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

const GAP = 24; // space between tiles
const RADIUS = 56;

/** The big first tile spanning the full height (上課簽到). */
async function heroTile(area, { fill, circle, sub }) {
  const { x, y, width, height } = area.bounds;
  const tx = x + GAP, ty = y + GAP / 2, tw = width - GAP * 1.5, th = height - GAP * 1.5;
  const cx = tx + tw / 2;
  const r = Math.min(220, tw * 0.27);
  const cy = ty + th * 0.4;
  const icon = await iconSvg(area.icon, { x: cx - r * 0.5, y: cy - r * 0.5, size: r, color: "#FFFFFF" });
  return `
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${RADIUS}" fill="${fill}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${circle}"/>
    ${icon}
    <text x="${cx}" y="${ty + th * 0.73}" text-anchor="middle" fill="#FFFFFF" font-family="${FONT}"
          font-weight="700" font-size="150" letter-spacing="8">${area.label}</text>
    ${area.hint ? `<text x="${cx}" y="${ty + th * 0.73 + 100}" text-anchor="middle" fill="${sub}"
          font-family="${FONT}" font-weight="500" font-size="60">${area.hint}</text>` : ""}`;
}

/** A regular tile. */
async function tile(area, { stroke }) {
  const { x, y, width, height } = area.bounds;
  const tx = x + GAP / 2, ty = y + GAP / 2, tw = width - GAP * 1.5, th = height - GAP * 1.5;
  const r = Math.min(150, th * 0.21);
  const rect = `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${RADIUS}" fill="${C.tile}" stroke="${stroke}" stroke-width="4"/>`;
  const cx = tx + tw / 2;
  const cy = ty + th * 0.4;
  const icon = await iconSvg(area.icon, { x: cx - r * 0.47, y: cy - r * 0.47, size: r * 0.94, color: C.brand });
  return `${rect}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.soft}"/>${icon}
    <text x="${cx}" y="${ty + th * 0.82}" text-anchor="middle" fill="${C.dark}" font-family="${FONT}"
          font-weight="700" font-size="108">${area.label}</text>`;
}

const parts = [`<rect width="${W}" height="${H}" fill="${C.bg}"/>`];
const [hero, ...rest] = DEF.areas;
parts.push(await heroTile(hero, { fill: C.brand, circle: "rgba(255,255,255,0.16)", sub: C.soft }));
for (const area of rest) parts.push(await tile(area, { stroke: C.line }));

const OUT = "public/images/richmenu/main.png";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
mkdirSync("public/images/richmenu", { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(OUT);
const kb = Math.round(statSync(OUT).size / 1024);
console.log(`${OUT} ${W}×${H} ${kb} KB`);
if (kb > 1024) throw new Error("LINE rejects rich menu images over 1 MB");
