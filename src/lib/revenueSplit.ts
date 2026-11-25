import { z } from "zod";

/**
 * 每堂分潤（Lesson.revenueSplit）：一堂點完名的收入，照 `steps` 的順序一步一步分，
 * 剩下的全部歸 `remainderLabel`（例：台南水庫）。每一步從哪裡算要講清楚：
 * - `total`：總收入 × num/den（不管前面扣了什麼）
 * - `remaining`：前面扣完剩下的 × num/den
 * - `fixed`：固定金額
 * 每一步無條件捨去到整數元，除不盡的零頭自然留到最後「剩下的」。收入不夠扣時剩下的是負數。
 */
export const SPLIT_BASES = ["total", "remaining", "fixed"] as const;
export type SplitBasis = (typeof SPLIT_BASES)[number];

export const SPLIT_BASIS_LABEL: Record<SplitBasis, string> = {
  total: "總收入",
  remaining: "剩下的",
  fixed: "固定 $",
};

const step = z
  .object({
    /** 顯示的名字：老師名、「場地費」…（選老師時抄老師名字，之後改名不會跟著動）。 */
    label: z.string().trim().min(1).max(20),
    /** 選的是名冊上的人時記下來（之後要做老師收入用）；場地費等是 null。 */
    teacherId: z.number().int().positive().nullable().default(null),
    basis: z.enum(SPLIT_BASES),
    /** 比例 = num/den（1/3、25/100）。fixed 不用。 */
    num: z.number().int().min(0).max(1000).nullable().default(null),
    den: z.number().int().min(1).max(1000).nullable().default(null),
    /** fixed 的金額。 */
    amount: z.number().int().min(0).max(10_000_000).nullable().default(null),
  })
  .refine((s) => (s.basis === "fixed" ? s.amount !== null : s.num !== null && s.den !== null && s.num <= s.den), {
    message: "INVALID_SPLIT_STEP",
  });

export const revenueSplitSchema = z.object({
  steps: z.array(step).max(12),
  remainderLabel: z.string().trim().min(1).max(20),
});

export type RevenueSplit = z.infer<typeof revenueSplitSchema>;
export type RevenueSplitStep = RevenueSplit["steps"][number];

/** DB 裡的 Json → RevenueSplit；壞掉或沒設定 = null。 */
export const parseRevenueSplit = (value: unknown): RevenueSplit | null => {
  if (value == null) return null;
  const parsed = revenueSplitSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** 「台南」→「台南水庫」；沒分部就叫「水庫」。 */
export const defaultRemainderLabel = (locationName: string | null | undefined) =>
  locationName ? `${locationName}水庫` : "水庫";

export interface SplitLine {
  label: string;
  teacherId: number | null;
  amount: number;
  /** 「$2,240 × 1/3」「固定」 */
  formula: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** 一堂收入照規則分下去。`income` 會先四捨五入到整數元。 */
export const computeSplit = (income: number, split: RevenueSplit) => {
  const total = Math.round(income);
  let remaining = total;
  const lines: SplitLine[] = split.steps.map((s) => {
    let amount: number;
    let formula: string;
    if (s.basis === "fixed") {
      amount = s.amount ?? 0;
      formula = "固定";
    } else {
      const base = s.basis === "total" ? total : Math.max(remaining, 0);
      amount = Math.floor((base * (s.num ?? 0)) / (s.den ?? 1));
      formula = `${s.basis === "total" ? "總收入" : "剩下的"} ${money(base)} × ${s.num}/${s.den}`;
    }
    remaining -= amount;
    return { label: s.label, teacherId: s.teacherId, amount, formula };
  });
  return { income: total, lines, remainder: { label: split.remainderLabel, amount: remaining } };
};

/** 「1/3」「25%」「0.5」→ { num, den }；看不懂回 null。 */
export const parseRatio = (text: string): { num: number; den: number } | null => {
  const t = text.trim();
  let m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    return den > 0 && num <= den && den <= 1000 ? { num, den } : null;
  }
  m = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (m) {
    const pct = Number(m[1]);
    if (pct > 100) return null;
    return Number.isInteger(pct) ? { num: pct, den: 100 } : { num: Math.round(pct * 10), den: 1000 };
  }
  return null;
};

export const formatRatio = (num: number | null, den: number | null) =>
  num === null || den === null ? "" : den === 100 ? `${num}%` : `${num}/${den}`;
