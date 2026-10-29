/**
 * 建城的步驟（設計稿「水庫建城（第一次設定）」，docs/finance-game/gen_setup.py）。
 * 四章 11 題；主堡那章答完停一下（KEEP_DONE），可以先到這裡（PAUSED）。
 */

export const STAGE = {
  INTRO: 0,
  OWNER: 1,
  START: 2,
  BALANCE: 3,
  LOAN: 4,
  CUSTODY: 5,
  KEEP_DONE: 6,
  TEACHERS: 7,
  PLACES: 8,
  VENUE_FEES: 9,
  PAY: 10,
  FEES: 11,
  TRIAL: 12,
  DONE: 13,
  PAUSED: 14,
} as const;

export type Stage = (typeof STAGE)[keyof typeof STAGE];

export const CHAPTERS = [
  { label: "主堡", from: STAGE.OWNER, to: STAGE.CUSTODY },
  { label: "居民", from: STAGE.TEACHERS, to: STAGE.TEACHERS },
  { label: "場地", from: STAGE.PLACES, to: STAGE.VENUE_FEES },
  { label: "分帳", from: STAGE.PAY, to: STAGE.TRIAL },
] as const;

/** 第幾題（共 11 題）；不是題目的步驟是 null。 */
export function questionNumber(stage: Stage): number | null {
  if (stage >= STAGE.OWNER && stage <= STAGE.CUSTODY) return stage;
  if (stage >= STAGE.TEACHERS && stage <= STAGE.TRIAL) return stage - 1;
  return null;
}

export const QUESTION_COUNT = 11;

/** 先到這裡的時候，小鎮停在主堡蓋好那一步。 */
export const sceneStage = (stage: Stage): Stage => (stage === STAGE.PAUSED ? STAGE.KEEP_DONE : stage);

/** 小鎮下方那顆膠囊：這題會蓋出什麼。 */
export const BUILDS: Record<Stage, string> = {
  0: "主堡預定地",
  1: "這題會蓋：主堡地基＋皇冠奇異鳥",
  2: "這題會蓋：主堡的牆＋開張旗",
  3: "這題會蓋：倉庫的箱子",
  4: "這題會蓋：建城貸款看板",
  5: "這題會蓋：代收人的背包",
  6: "第一塊蓋好了：主堡能收錢",
  7: "這題會蓋：小鎮居民",
  8: "這題會蓋：上課的地方",
  9: "這題會蓋：場地費招牌",
  10: "這題會蓋：通往主堡的路",
  11: "這題會蓋：水庫基金池",
  12: "最後一步：屋頂和旗子",
  13: "主堡完工！",
  14: "先開張：居民、場地、分帳之後再蓋",
};
