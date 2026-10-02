// 課卡編號：資料庫存每間教室的流水號 n（StudentCard.serialNumber，從 1 開始），
// 顯示成「一個字母 + 四位數」：A0001…A9999 → B0001…B9999 → C0001…
// 每個字母都從 0001 開始、沒有 0000，所以一個字母裝 9999 張。
// 純函式，server 與 client 共用。

const PER_LETTER = 9999;
const FIRST_LETTER = "A".charCodeAt(0);
const LETTER_COUNT = 26;

/** 1 → "#A0001"、9999 → "#A9999"、10000 → "#B0001"。 */
export function formatCardSerial(serialNumber: number): string {
  const index = serialNumber - 1;
  const letter = String.fromCharCode(FIRST_LETTER + Math.floor(index / PER_LETTER));
  const digits = String((index % PER_LETTER) + 1).padStart(4, "0");
  return `#${letter}${digits}`;
}

/**
 * 把使用者輸入的編號轉回流水號；接受 "A0412"、"#a0412"、前後空白。
 * 不是編號格式（含 "A0000"）回傳 null —— 搜尋框拿它來判斷「這是不是在找卡號」。
 */
export function parseCardSerial(input: string): number | null {
  const match = /^#?([A-Z])(\d{4})$/i.exec(input.trim());
  if (!match) return null;
  const letterIndex = match[1].toUpperCase().charCodeAt(0) - FIRST_LETTER;
  const digits = Number(match[2]);
  if (letterIndex < 0 || letterIndex >= LETTER_COUNT || digits === 0) return null;
  return letterIndex * PER_LETTER + digits;
}
