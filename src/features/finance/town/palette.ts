/**
 * 奇異鳥小鎮的色票（docs/finance-game-style.md §3.2）。這套是水庫遊戲畫面自己的插圖色，
 * 不是設計系統 token；按鈕、表單仍用 primary／neutral。
 */

/** 立體物件的三個面：頂、左前、右前。 */
export type Faces = readonly [top: string, left: string, right: string];

export const INK = "#4D4239";
export const SUB = "#8C7B6B";
export const PAPER = "#FFFDF7";
export const GROUND = "#CDDA9F";

export const FACES = {
  crate: ["#F7D88F", "#EBBE6B", "#D5A256"],
  wall: ["#F8DCC8", "#E9B195", "#D5987C"],
  post: ["#FBE7D8", "#EDBBA0", "#D9A186"],
  stone: ["#F6F1E8", "#EBE3D5", "#D8CDBB"],
  battlement: ["#FFFFFF", "#F1EADD", "#DED3C1"],
  cream: ["#FFF6E6", "#F7E8CE", "#E7D2B0"],
  mint: ["#EEF7F3", "#D6ECE4", "#BFDCD2"],
  roofRim: ["#FBF8F1", "#ECE6D8", "#DAD2C1"],
  wood: ["#E5BE90", "#D2A474", "#BC8B5C"],
  chimney: ["#E7A58B", "#D98E73", "#C67C63"],
  vent: ["#D9E2E6", "#C3CFD5", "#AEBCC3"],
} satisfies Record<string, Faces>;

export const TOWN = {
  shadow: "#55632E",
  grassDark: "#C3D28F",
  grassLight: "#D6E1AC",
  garden: "#D8E2A8",
  plaza: "#E4E1CD",
  plazaLine: "#D6D2BC",
  yard: "#EADFC6",
  water: "#9DD3CB",
  waterDeep: "#8BC8C0",
  bank: "#E3F0DA",
  road: "#EFE1BB",
  roadEdge: "#DCC899",
  wheat: "#EECF7A",
  wheatRow: "#E0BB5C",
  rug: "#F6D5D2",
  crateBand: ["#D9A452", "#C48F42"],
  keepRoof: ["#A6D8CE", "#8FCABF", "#74B3A8"],
  coral: "#EE9C7E",
  coralLight: "#F6B79D",
  glass: "#BFE3E6",
  window: "#6E9C95",
  door: "#A57B50",
  doorLight: "#B98B5E",
  awning: "#86BBD8",
  flag: "#4BB38B",
  lamp: "#FFE7A3",
  wait: "#F4A23C",
  waitText: "#B86A12",
  waitBg: "#FFF1DE",
  late: "#E8735F",
  lateText: "#C4473A",
  lateBg: "#FBE1DC",
  grow: "#86C64F",
  growText: "#4E9A2F",
  growTrack: "#E7EFD8",
  coin: "#F6C344",
  coinRim: "#E2A62C",
  coinText: "#B9801C",
  sack: "#F2C45A",
} as const;
