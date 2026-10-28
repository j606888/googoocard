/**
 * 兩張地圖的擺設（docs/finance-game-style.md §4）：電腦橫式、手機直式。
 * 數字照設計稿（docs/finance-game/gen_game.py、gen_mobile.py）搬過來，都是格子座標。
 */

import type { GridPt } from "./iso";

type Span = readonly [number, number];

export interface TownLayout {
  kind: "wide" | "tall";
  origin: readonly [number, number];
  /** SVG viewBox：x、y、寬、高（設計座標）。 */
  viewBox: readonly [number, number, number, number];
  /** 泡泡、名牌在畫面上想要多大（1 = 設計稿原尺寸）；地圖縮小時會反向放大回來。 */
  bubbleTarget: number;
  ground: {
    patches: readonly (readonly [cx: number, cy: number, r: number, light: boolean])[];
    garden: readonly [number, number, number, number];
    plaza: readonly [number, number, number, number];
    river: { y: number; pool?: readonly [number, number] };
    wheat: readonly [number, number, number, number];
    roads: readonly { path: readonly GridPt[]; width: number }[];
    lilies: readonly GridPt[];
    ripples: readonly GridPt[];
  };
  yard: { x0: number; x1: number; y0: number; y1: number; gate: Span };
  keep: { gx: number; gy: number; size: number; height: number; roof: number };
  /** 箱子堆的位置；每堆 nx × ny，最多疊 3 層。 */
  piles: readonly { gx: number; gy: number; nx: number; ny: number }[];
  classroom: { gx: number; gy: number; w: number; d: number; h: number; door: Span; window: Span; sideWindows: readonly Span[]; awning: Span; sign: boolean };
  house: { gx: number; gy: number; door: Span; sideWindows: readonly Span[]; frontWindows: readonly Span[]; chimney: GridPt };
  floor: { gx: number; gy: number; w: number; d: number; dancers: readonly [GridPt, GridPt] };
  bridge: { gx: number; gy: number; w: number; d: number };
  decor: {
    pines: readonly (readonly [number, number, number, number])[];
    apples: readonly (readonly [number, number, number])[];
    trees: readonly (readonly [number, number, number])[];
    blossoms: readonly (readonly [number, number, number])[];
    bushes: readonly (readonly [number, number, number])[];
    rocks: readonly (readonly [number, number, number])[];
    flowers: readonly (readonly [number, number, string])[];
    markers: readonly GridPt[];
  };
  /** 營收負責人站在主堡裡的位置。 */
  owner: { at: GridPt; flip?: boolean };
  /**
   * 代收人可以站的位置（手上有錢的人依多寡排進去，排不下的只在背包列）。
   * `route`：從他家門口走到主堡門口的路（推車走這條），最後一點是推車停下來等確認的地方。
   */
  slots: readonly { at: GridPt; flip?: boolean; route: readonly GridPt[] }[];
  /** 主堡門口 → 倉庫裡（確認後推車走進去）。 */
  entry: readonly GridPt[];
  /**
   * 地區看板的位置：電腦是畫面座標上的白色看板，手機是插在地上的木牌（格子座標）。
   * 寫什麼字看教室的分部（/locations）：第一個分部放河的這岸（房子），第二個放對岸（主堡、教室）。
   */
  regions: readonly { banner: readonly [number, number]; sign: GridPt }[];
}

const WHITE = "#FFFFFF";
const PINK = "#F6B6C8";

export const WIDE: TownLayout = {
  kind: "wide",
  origin: [680, 40],
  viewBox: [0, 0, 1280, 800],
  bubbleTarget: 1,
  ground: {
    patches: [
      [4, 2, 3, false], [16, 18, 3.4, false], [24, 3, 3, true], [6, 22, 2.6, true],
      [26, 16, 2.4, false], [1, 15, 2.2, true], [9, -2, 2.8, true], [20, -1, 2, false],
    ],
    garden: [2.2, 12.9, 10.6, 8.6],
    plaza: [10.2, 1.2, 14, 9.7],
    river: { y: 11.15, pool: [1.6, 10.4] },
    wheat: [16.4, 13.5, 4.8, 3.2],
    roads: [
      { path: [[8.3, 15.5], [13.5, 15.5], [13.5, 8.5]], width: 1 },
      { path: [[13.9, 10.15], [21.2, 10.15]], width: 0.9 },
    ],
    lilies: [[0.8, 9.8], [2.3, 11.0], [8.5, 11.75], [24, 11.6]],
    ripples: [[-6, 11.5], [6, 11.9], [17, 11.45], [25, 11.85]],
  },
  yard: { x0: 11, x1: 18.8, y0: 2, y1: 8.6, gate: [13.0, 14.2] },
  keep: { gx: 11.4, gy: 2.4, size: 2, height: 80, roof: 46 },
  piles: [
    { gx: 14.6, gy: 2.5, nx: 4, ny: 2 },
    { gx: 14.6, gy: 4.2, nx: 4, ny: 2 },
    { gx: 15.3, gy: 5.9, nx: 3, ny: 2 },
  ],
  classroom: { gx: 19.5, gy: 7.2, w: 3, d: 2.4, h: 46, door: [20.15, 20.95], window: [21.25, 22.25], sideWindows: [[7.6, 8.4], [8.75, 9.35]], awning: [20.0, 22.4], sign: true },
  house: { gx: 5.5, gy: 14, door: [15.0, 15.9], sideWindows: [[16.2, 16.8], [14.3, 14.8]], frontWindows: [[6.0, 6.8], [7.2, 8.0]], chimney: [6.0, 14.4] },
  floor: { gx: 9.2, gy: 12.95, w: 2.4, d: 1.85, dancers: [[9.95, 13.55], [10.95, 14.25]] },
  bridge: { gx: 12.9, gy: 10.95, w: 1.2, d: 1.6 },
  decor: {
    pines: [
      [3, 5, 64, 1], [4.6, 4.1, 72, 1.05], [5.9, 5.7, 58, 0.95], [3.6, 7.3, 54, 0.9], [7.3, 4.3, 66, 1], [6.6, 7.6, 60, 0.95],
      [2.2, 8.4, 50, 0.85], [8.7, 6.3, 56, 0.9], [24.6, 4.6, 70, 1.05], [25.8, 6.8, 62, 1], [4.2, 1.2, 58, 0.9], [17.2, 0, 60, 0.95],
    ],
    apples: [[22.2, 13.6, 0.82], [23.8, 13.2, 0.82], [25.4, 13.9, 0.82], [22.8, 15.2, 0.82], [24.4, 15.0, 0.82], [26.0, 15.6, 0.82]],
    trees: [[7.2, 19.8, 1], [9.2, 21.0, 0.9], [11.2, 21.6, 1], [13.4, 21.4, 0.85], [20.6, 18.4, 1]],
    blossoms: [[4.3, 17.6, 0.95], [15.4, 17.4, 0.9]],
    bushes: [[3.0, 13.4, 0.9], [11.9, 17.2, 0.8], [16.0, 12.9, 0.7], [21.6, 12.9, 0.8], [0.2, 12.8, 0.8], [19.8, 1.6, 0.8], [23.4, 9.8, 0.8], [12.2, 13.0, 0.7]],
    rocks: [[-0.4, 9.2, 1], [3.7, 9.0, 0.8], [3.9, 11.9, 0.7], [10.5, 12.8, 0.7], [19.6, 12.8, 0.9], [26.2, 10.4, 1]],
    flowers: [[5.0, 18.6, WHITE], [10.4, 18.2, PINK], [3.4, 15.6, WHITE], [12, 19.6, WHITE], [22.2, 14.8, PINK], [8.8, 13.0, WHITE]],
    markers: [[8.35, 14.8], [14.2, 16.15], [14.2, 8.4], [21.3, 9.55], [12.8, 12.9]],
  },
  owner: { at: [12.4, 5.05] },
  slots: [
    { at: [9.25, 16.75], route: [[9.4, 15.5], [13.5, 15.5], [13.5, 9.3]] },
    { at: [21.55, 10.35], flip: true, route: [[21.0, 10.15], [13.5, 10.15], [13.5, 9.3]] },
  ],
  entry: [[13.5, 9.3], [13.5, 7.9], [12.9, 5.8]],
  regions: [
    { banner: [214, 248], sign: [4.6, 18.4] },
    { banner: [1076, 186], sign: [19.6, 6.6] },
  ],
};

const TALL_ROAD: readonly GridPt[] = [
  [7.6, 5.0], [7.7, 5.5], [9.2, 6.6], [10.6, 7.6], [11.2, 8.3], [11.2, 10.1], [12.2, 10.9], [14.0, 11.7],
  [16.0, 12.4], [18.0, 12.6], [18.5, 13.4], [18.5, 14.45],
];

export const TALL: TownLayout = {
  kind: "tall",
  origin: [150, 310],
  viewBox: [0, 168, 520, 752],
  bubbleTarget: 0.94,
  ground: {
    patches: [
      [0, 1, 2.4, false], [12, -1, 2, true], [6, 12.5, 2, false], [20, 9, 2.2, true],
      [14, 18.5, 2.4, false], [-1, 6, 2, true], [22, 15, 2, false],
    ],
    garden: [12.6, 10.15, 9, 7.6],
    plaza: [2.2, -1, 11, 7],
    river: { y: 8.6 },
    wheat: [9.3, 11.5, 2.2, 1.4],
    roads: [
      { path: TALL_ROAD, width: 0.84 },
      { path: [[12.6, 5.45], [9.4, 6.55]], width: 0.7 },
    ],
    lilies: [[6.2, 9.1], [14.6, 9.4], [17.4, 9.0]],
    ripples: [[4, 8.95], [14, 9.35]],
  },
  yard: { x0: 3, x1: 9, y0: 0, y1: 5.2, gate: [7.0, 8.2] },
  keep: { gx: 3.2, gy: 0.2, size: 1.8, height: 70, roof: 42 },
  piles: [
    { gx: 5.4, gy: 0.3, nx: 4, ny: 2 },
    { gx: 5.4, gy: 1.8, nx: 4, ny: 2 },
    { gx: 6.1, gy: 3.3, nx: 3, ny: 2 },
  ],
  classroom: { gx: 9.8, gy: 3.0, w: 2.4, d: 2.0, h: 40, door: [10.3, 11.0], window: [11.25, 12.0], sideWindows: [[3.3, 3.9], [4.2, 4.75]], awning: [10.15, 12.1], sign: false },
  house: { gx: 14.5, gy: 13, door: [14.0, 14.9], sideWindows: [[15.2, 15.8], [13.3, 13.8]], frontWindows: [[15.0, 15.8], [16.2, 17.0]], chimney: [15.0, 13.4] },
  floor: { gx: 15.4, gy: 10.0, w: 2.0, d: 1.4, dancers: [[16.0, 10.5], [16.9, 11.0]] },
  bridge: { gx: 10.7, gy: 8.4, w: 1.0, d: 1.6 },
  decor: {
    pines: [
      [1.2, 4.2, 56, 0.9], [0.2, 2.6, 60, 0.95], [2.4, 6.2, 50, 0.85], [3.6, 7.4, 48, 0.8], [5.2, 7.6, 46, 0.8], [11.4, 0.4, 58, 0.9],
      [10.4, -1, 62, 0.95], [8.6, -1.6, 54, 0.85], [17.5, 7.2, 60, 0.95], [18.8, 8.1, 50, 0.85], [1.5, -1.5, 56, 0.9], [-0.8, 0.6, 52, 0.85],
    ],
    apples: [[20, 11.4, 0.75], [21.6, 11.0, 0.75], [20.8, 12.6, 0.75], [22.4, 12.4, 0.75]],
    trees: [[13.8, 18.0, 0.9], [16.2, 18.8, 0.85], [22.6, 14.6, 0.85]],
    blossoms: [[12.2, 15.2, 0.85]],
    bushes: [[12.4, 12.6, 0.7], [19.4, 10.4, 0.7], [6.6, 7.9, 0.7], [13.4, 7.6, 0.7], [2.6, -0.6, 0.7]],
    rocks: [[9.4, 8.2, 0.8], [15.6, 8.2, 0.8], [8.0, 10.2, 0.7]],
    flowers: [[14.2, 12.6, WHITE], [19.6, 16.4, PINK], [13.4, 15.0, WHITE], [17.8, 17.2, WHITE]],
    markers: [[11.75, 8.15], [11.75, 10.25], [19.0, 13.4]],
  },
  owner: { at: [3.9, 2.8] },
  slots: [
    { at: [18.9, 15.2], route: [...TALL_ROAD.slice(2).reverse(), [8.15, 5.83]] },
    { at: [12.9, 4.6], flip: true, route: [[12.6, 5.45], [9.4, 6.55], [8.15, 5.83]] },
  ],
  entry: [[8.15, 5.83], [7.65, 5.2], [7.5, 4.5], [4.9, 3.4]],
  regions: [
    { banner: [0, 0], sign: [12.9, 13.6] },
    { banner: [0, 0], sign: [10.9, 1.3] },
  ],
};
