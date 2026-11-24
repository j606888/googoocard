// 「這是你嗎？」(LIFF 門口簽到) 用 LINE 顯示名稱猜名單上哪一位最像本人。
// 純函式、只拿來排序與標「最像你的」——綁定永遠是學生自己按的。

/** 小寫、去掉空白、標點、emoji，只留字母數字與中日韓字。 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 兩個字串最長的共同連續片段長度。 */
function longestCommonSubstring(a: string, b: string): number {
  const chars = (s: string) => Array.from(s); // 以字元（含 CJK / surrogate pair）計
  const x = chars(a);
  const y = chars(b);
  let best = 0;
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

/**
 * 0–1：共同片段佔較短那個名字的比例。至少要連續 2 個字相同才算（避免「小」「美」
 * 這種單字撞到一堆人）；只有一個字的名字要整個相同。
 */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  const shorter = Math.min(Array.from(x).length, Array.from(y).length);
  const common = longestCommonSubstring(x, y);
  if (common < Math.min(2, shorter)) return 0;
  return common / shorter;
}

/**
 * 名單裡跟 `lineName` 最像的那一位；沒有夠像的、或並列第一（猜不出來）時回 null。
 */
export function bestNameMatch<T extends { id: number; name: string }>(
  lineName: string,
  candidates: T[],
  threshold = 0.5
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const c of candidates) {
    const score = nameSimilarity(lineName, c.name);
    if (score > bestScore) {
      best = c;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0 && c.id !== best?.id) {
      tied = true;
    }
  }
  return best && bestScore >= threshold && !tied ? best : null;
}
