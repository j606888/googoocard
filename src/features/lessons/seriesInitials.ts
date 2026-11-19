const CJK = /^[぀-ヿ㐀-鿿가-힯]/;
/** 「Lv1」「LV 2」「Level」「3」「2.」這類不代表課名的字。 */
const NOISE = /^((lv|level|l)\.?\d*|\d+\.?)$/i;

/**
 * 課種色塊上的兩個字母：「Bachata Lv1」→ Ba、「Body movement」→ Bm、「街舞入門」→ 街。
 * 兩個字以上取各自的字首，只有一個字取前兩個字母；級數與編號不算字。
 */
export const seriesInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !NOISE.test(word));
  const [first, second] = meaningful.length > 0 ? meaningful : words;
  if (!first) return "?";
  if (CJK.test(first)) return [...first][0];
  const head = [...first][0].toUpperCase();
  if (second && !CJK.test(second)) return head + [...second][0].toLowerCase();
  return head + ([...first][1]?.toLowerCase() ?? "");
};
