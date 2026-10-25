// 把 Rich Menu 上到官方帳號，並設成所有人的預設選單。
//
//   npm run richmenu:provision            # 只印出要做什麼（dry run）
//   npm run richmenu:provision -- --yes   # 真的送出
//
// 用哪個官方帳號，由 env 的 LINE_CHANNEL_ACCESS_TOKEN 決定（預設讀 .env；要上
// production 就用 production 的 token 跑，例如 `node --env-file=.env.production
// scripts/provision-line-richmenu.mjs --yes`）。NEXT_PUBLIC_LIFF_ID 決定 LIFF 按鈕
// 打開哪個 LIFF。
//
// 一張選單、所有人共用：內容依「這個 LINE 是誰」由 webhook 決定（src/service/lineBot.ts），
// 所以不用逐人 link，也不用資料表。重跑是安全的：建新的 → 上傳圖 → 設成預設 →
// 刪掉同名的舊選單。
// 區塊定義：src/lib/lineRichMenu.json；圖：scripts/generate-richmenu.mjs 產生的
// public/images/richmenu/main.png。

import { readFileSync } from "node:fs";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const API = "https://api.line.me/v2/bot";
const API_DATA = "https://api-data.line.me/v2/bot";
const IMAGE = "public/images/richmenu/main.png";
const confirmed = process.argv.includes("--yes");

const MENU = JSON.parse(readFileSync("src/lib/lineRichMenu.json", "utf8"));

// Mirror of src/lib/lineRichMenu.ts richMenuAction (an .mjs can't import TS).
function lineAction(area) {
  const [kind, target] = area.action.split(":");
  if (kind === "liff") return { type: "uri", label: area.label, uri: `https://liff.line.me/${LIFF_ID}/${target}` };
  return { type: "postback", label: area.label, data: `a=${target}`, displayText: area.label };
}

const body = {
  size: MENU.size,
  selected: false,
  name: MENU.name,
  chatBarText: MENU.chatBarText,
  areas: MENU.areas.map((area) => ({ bounds: area.bounds, action: lineAction(area) })),
};

async function line(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function main() {
  if (!TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  if (!LIFF_ID) throw new Error("NEXT_PUBLIC_LIFF_ID is not set — the LIFF buttons would go nowhere");

  const bot = await line(`${API}/info`);
  console.log(`官方帳號：${bot.displayName}（${bot.basicId}）`);
  console.log(`LIFF：${LIFF_ID}`);
  for (const area of body.areas) {
    const a = area.action;
    console.log(`  ${a.label.padEnd(6, "　")} → ${a.type === "uri" ? a.uri : a.data}`);
  }
  if (!confirmed) {
    console.log("\n只是預覽。確認無誤後加 --yes 真的送出。");
    return;
  }

  const { richmenus = [] } = await line(`${API}/richmenu/list`);
  const old = richmenus.filter((m) => m.name === MENU.name);

  const { richMenuId } = await line(`${API}/richmenu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await line(`${API_DATA}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: readFileSync(IMAGE),
  });
  await line(`${API}/user/all/richmenu/${richMenuId}`, { method: "POST" });
  console.log(`已建立並設為預設：${richMenuId}`);

  for (const m of old) {
    await line(`${API}/richmenu/${m.richMenuId}`, { method: "DELETE" });
    console.log(`已刪除舊選單：${m.richMenuId}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
