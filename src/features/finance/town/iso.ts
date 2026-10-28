/**
 * 2:1 等角投影（docs/finance-game-style.md §3.1）：一格寬 64、高 32，高度 z 用 px。
 * 跟 docs/finance-game/gen_game.py 的 `P()` 同一個公式。
 */

export type Pt = readonly [number, number];
/** 格子座標 → 畫面座標。 */
export type Proj = (gx: number, gy: number, z?: number) => Pt;
export type GridPt = readonly [number, number];

export const HALF_W = 32;
export const HALF_H = 16;

export function projector(ox: number, oy: number): Proj {
  return (gx, gy, z = 0) => [ox + (gx - gy) * HALF_W, oy + (gx + gy) * HALF_H - z];
}

export function pointsAttr(ps: readonly Pt[]): string {
  return ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** 把格子座標畫成地上的平面（路、河、地墊）：群組套這個 transform，裡面直接用格子座標。 */
export function groundTransform(ox: number, oy: number, lift = 0): string {
  return `translate(0 ${-lift}) matrix(${HALF_W} ${HALF_H} ${-HALF_W} ${HALF_H} ${ox} ${oy})`;
}

/** 折線總長（格子單位）。 */
export function pathLength(path: readonly GridPt[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

/**
 * 沿著折線走 `distance` 格的位置，順便回傳那一段的方向（格子單位）。
 * 超出範圍就停在頭或尾。
 */
export function pointAlong(path: readonly GridPt[], distance: number): { at: GridPt; dir: GridPt } {
  if (path.length < 2) return { at: path[0] ?? [0, 0], dir: [0, -1] };
  let left = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const len = Math.hypot(bx - ax, by - ay);
    const dir: GridPt = [(bx - ax) / (len || 1), (by - ay) / (len || 1)];
    if (left <= len || i === path.length - 1) {
      const t = Math.min(1, left / (len || 1));
      return { at: [ax + (bx - ax) * t, ay + (by - ay) * t], dir };
    }
    left -= len;
  }
  return { at: path[path.length - 1], dir: [0, -1] };
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
