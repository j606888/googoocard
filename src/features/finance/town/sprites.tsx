/**
 * 小鎮的基本圖形：等角方塊、樹、石頭、路標、箱子、奇異鳥。
 * 全部是純 SVG、沒有狀態；位置用格子座標，`P` 是這張地圖的投影。
 * 對照 docs/finance-game/gen_game.py 的同名函式。
 */

import { pointsAttr, type Proj, type Pt } from "./iso";
import { FACES, TOWN, INK, type Faces } from "./palette";

export function Poly({ ps, fill }: { ps: readonly Pt[]; fill: string }) {
  return <polygon points={pointsAttr(ps)} fill={fill} />;
}

/** 三面三色的方塊（頂最亮、左前居中、右前最暗）。 */
export function IsoBox({ P, gx, gy, w, d, h, faces, z = 0 }: { P: Proj; gx: number; gy: number; w: number; d: number; h: number; faces: Faces; z?: number }) {
  const [top, left, right] = faces;
  return (
    <g>
      <Poly ps={[P(gx, gy + d, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)]} fill={left} />
      <Poly ps={[P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx + w, gy, z + h)]} fill={right} />
      <Poly ps={[P(gx, gy, z + h), P(gx + w, gy, z + h), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)]} fill={top} />
    </g>
  );
}

/** 貼在左前面（gy 固定）的矩形：門、窗。 */
export function FaceL({ P, gx0, gx1, gy, z0, z1, fill }: { P: Proj; gx0: number; gx1: number; gy: number; z0: number; z1: number; fill: string }) {
  return <Poly ps={[P(gx0, gy, z0), P(gx1, gy, z0), P(gx1, gy, z1), P(gx0, gy, z1)]} fill={fill} />;
}

/** 貼在右前面（gx 固定）的矩形。 */
export function FaceR({ P, gy0, gy1, gx, z0, z1, fill }: { P: Proj; gy0: number; gy1: number; gx: number; z0: number; z1: number; fill: string }) {
  return <Poly ps={[P(gx, gy0, z0), P(gx, gy1, z0), P(gx, gy1, z1), P(gx, gy0, z1)]} fill={fill} />;
}

/** 左前面上的拱門。 */
export function ArchL({ P, gxc, hw, gy, z0, zt, hz, fill }: { P: Proj; gxc: number; hw: number; gy: number; z0: number; zt: number; hz: number; fill: string }) {
  const ps: Pt[] = [P(gxc - hw, gy, z0), P(gxc - hw, gy, zt)];
  for (let i = 1; i < 12; i++) {
    const t = Math.PI - (Math.PI * i) / 12;
    ps.push(P(gxc + hw * Math.cos(t), gy, zt + hz * Math.sin(t)));
  }
  ps.push(P(gxc + hw, gy, zt), P(gxc + hw, gy, z0));
  return <Poly ps={ps} fill={fill} />;
}

export function Shadow({ x, y, rx, ry, opacity = 0.16 }: { x: number; y: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={TOWN.shadow} opacity={opacity} />;
}

/** 低多邊形松樹（兩層圓錐，左亮右暗）。 */
export function Pine({ P, gx, gy, h = 62, s = 1 }: { P: Proj; gx: number; gy: number; h?: number; s?: number }) {
  const [x, y] = P(gx, gy);
  const r = 16 * s;
  const tiers: [number, number, number][] = [
    [r, y - 9, y - 9 - h * 0.62],
    [r * 0.76, y - 9 - h * 0.36, y - 9 - h],
  ];
  return (
    <g>
      <Shadow x={x + 4} y={y + 1} rx={r + 6} ry={(r + 6) / 2.2} />
      <rect x={x - 2.5} y={y - 12} width={5} height={13} rx={2} fill="#9C7A56" />
      {tiers.map(([bw, by, ty], i) => (
        <g key={i}>
          <Poly ps={[[x - bw, by], [x, by + bw * 0.34], [x, ty]]} fill="#93BE6E" />
          <Poly ps={[[x, by + bw * 0.34], [x + bw, by], [x, ty]]} fill="#729F57" />
        </g>
      ))}
    </g>
  );
}

const LEAF = ["#B2D47F", "#93BE66", "#C9E39C"] as const;
const BLOSSOM = ["#F7C6D2", "#EEAABD", "#FCDDE5"] as const;

/** 圓樹；`fruit` 是果園的紅蘋果，`blossom` 是粉色花樹。 */
export function RoundTree({ P, gx, gy, s = 1, fruit = false, blossom = false }: { P: Proj; gx: number; gy: number; s?: number; fruit?: boolean; blossom?: boolean }) {
  const [x, y] = P(gx, gy);
  const c = blossom ? BLOSSOM : LEAF;
  const blobs: [number, number, number, string][] = [
    [-10, -30, 14, c[1]],
    [10, -30, 14, c[1]],
    [0, -41, 16, c[0]],
    [-5, -46, 7, c[2]],
  ];
  return (
    <g>
      <Shadow x={x + 3} y={y + 1} rx={22 * s} ry={9 * s} />
      <rect x={x - 3 * s} y={y - 20 * s} width={6 * s} height={21 * s} rx={2.5} fill="#A07B55" />
      {blobs.map(([cx, cy, r, col], i) => (
        <circle key={i} cx={x + cx * s} cy={y + cy * s} r={r * s} fill={col} />
      ))}
      {fruit &&
        [[-12, -27], [7, -24], [12, -36], [-4, -36], [2, -50], [-15, -38]].map(([fx, fy], i) => (
          <circle key={`f${i}`} cx={x + fx * s} cy={y + fy * s} r={2.8 * s} fill="#E8735F" />
        ))}
    </g>
  );
}

export function Bush({ P, gx, gy, s = 1 }: { P: Proj; gx: number; gy: number; s?: number }) {
  const [x, y] = P(gx, gy);
  return (
    <g>
      <Shadow x={x} y={y + 1} rx={15 * s} ry={6 * s} />
      <circle cx={x - 6 * s} cy={y - 6 * s} r={8 * s} fill="#8FBB63" />
      <circle cx={x + 6 * s} cy={y - 6 * s} r={8 * s} fill="#8FBB63" />
      <circle cx={x} cy={y - 11 * s} r={9 * s} fill="#A9CF79" />
    </g>
  );
}

export function Rock({ P, gx, gy, s = 1 }: { P: Proj; gx: number; gy: number; s?: number }) {
  const [x, y] = P(gx, gy);
  return (
    <g>
      <ellipse cx={x} cy={y - 3 * s} rx={11 * s} ry={7 * s} fill="#CFC7B5" />
      <ellipse cx={x - 2 * s} cy={y - 5 * s} rx={8 * s} ry={4.5 * s} fill="#E3DDCF" />
    </g>
  );
}

export function Flowers({ P, gx, gy, color = "#FFFFFF" }: { P: Proj; gx: number; gy: number; color?: string }) {
  const [x, y] = P(gx, gy);
  return (
    <g>
      {[[-6, 0], [0, -3], [6, 1], [2, 4]].map(([dx, dy], i) => (
        <g key={i}>
          <circle cx={x + dx} cy={y + dy} r={2.3} fill={color} />
          <circle cx={x + dx} cy={y + dy} r={0.9} fill="#F3C24E" />
        </g>
      ))}
    </g>
  );
}

/** 路標：白色柱子＋藍色圓盤（The Colonists 的手法）。 */
export function Marker({ P, gx, gy }: { P: Proj; gx: number; gy: number }) {
  const [x, y] = P(gx, gy);
  return (
    <g>
      <Shadow x={x} y={y + 1} rx={6} ry={2.5} opacity={0.2} />
      <rect x={x - 1.6} y={y - 20} width={3.2} height={20} rx={1.4} fill="#FFFFFF" />
      <ellipse cx={x} cy={y - 21} rx={6} ry={3.4} fill="#8CC0DD" />
      <ellipse cx={x - 1.5} cy={y - 22} rx={2.5} ry={1.2} fill="#D6ECF6" />
    </g>
  );
}

export const CRATE_SIZE = 0.62;
const CRATE_HEIGHT = CRATE_SIZE * 34;

/** 主堡倉庫的一箱錢；`z` 是第幾層。 */
export function Crate({ P, gx, gy, layer }: { P: Proj; gx: number; gy: number; layer: number }) {
  const s = CRATE_SIZE;
  const z = layer * CRATE_HEIGHT;
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={s} d={s} h={CRATE_HEIGHT} faces={FACES.crate} z={z} />
      <FaceL P={P} gx0={gx} gx1={gx + s} gy={gy + s} z0={z + CRATE_HEIGHT * 0.42} z1={z + CRATE_HEIGHT * 0.58} fill={TOWN.crateBand[0]} />
      <FaceR P={P} gy0={gy} gy1={gy + s} gx={gx + s} z0={z + CRATE_HEIGHT * 0.42} z1={z + CRATE_HEIGHT * 0.58} fill={TOWN.crateBand[1]} />
    </g>
  );
}

export type KiwiAccessory = "pack" | "sack" | "crown" | "cap";

/**
 * Googoocard 的奇異鳥（style doc §3.4）：圍巾顏色＝這個人，配件＝身分或狀態。
 * 原點在腳下，預設面向右；`flip` 面向左。
 */
export function Kiwi({ x, y, s = 1, scarf, flip = false, accessory }: { x: number; y: number; s?: number; scarf: string; flip?: boolean; accessory?: KiwiAccessory }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(flip ? -s : s).toFixed(2)} ${s.toFixed(2)})`}>
      <ellipse cx={0} cy={1} rx={15} ry={5} fill={TOWN.shadow} opacity={0.18} />
      <path d="M-5 -4 l-1.8 5.5 M4 -4 l1.8 5.5" stroke="#E39B4A" strokeWidth={2.8} strokeLinecap="round" />
      {accessory === "pack" && (
        <>
          <rect x={-22} y={-27} width={13} height={16} rx={4.5} fill="#F2B35B" />
          <rect x={-20} y={-22} width={9} height={5} rx={2} fill="#E59A3E" />
        </>
      )}
      <ellipse cx={0} cy={-13} rx={15.5} ry={12.5} fill="#BF9064" />
      <path d="M-15.5 -12 a15.5 12.5 0 0 0 31 0 q-15.5 7 -31 0z" fill="#A97C52" />
      <ellipse cx={-4} cy={-18} rx={8} ry={4.5} fill="#D3AC80" opacity={0.75} />
      <circle cx={10} cy={-20} r={8.5} fill="#BF9064" />
      {accessory === "pack" && <path d="M-9 -24 q4 6 2 14" stroke="#E59A3E" strokeWidth={2.2} fill="none" strokeLinecap="round" />}
      {accessory === "sack" && (
        <>
          <path d="M-25 -2 q-6 -9 1 -13 l-2 -3.5 h8.5 l-2 3.5 q7 4 1.5 13z" fill={TOWN.sack} />
          <path d="M-23.5 -16 h7" stroke="#D29A2E" strokeWidth={1.6} />
        </>
      )}
      <path d="M16.5 -19.5 q8 3 12.5 12" stroke="#F1D39C" strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <circle cx={12.6} cy={-22.5} r={1.9} fill="#3D3029" />
      <circle cx={13.3} cy={-23.2} r={0.7} fill="#FFFFFF" />
      <ellipse cx={12.5} cy={-17.6} rx={2.8} ry={1.7} fill="#F4A79E" opacity={0.85} />
      <path d="M2.5 -15.5 q7 3.2 13.5 -1.2 l.8 4 q-7 4.2 -14.4 1.4z" fill={scarf} />
      <path d="M5 -12 l-2.5 6.5 l4.5 -1.4z" fill={scarf} />
      {accessory === "crown" && (
        <>
          <path d="M4.5 -27 l1.6 -7 l3.4 4.2 l2.6 -5.6 l2.6 5.6 l3.4 -4.2 l1.4 7z" fill={TOWN.coin} />
          <circle cx={12} cy={-33.6} r={1.3} fill="#F08A7E" />
        </>
      )}
      {accessory === "cap" && (
        <>
          <path d="M2.5 -25.5 q8 -10 16.5 -1.2z" fill="#6FA8DC" />
          <path d="M16 -25.6 l8 1.6 l-8 1z" fill="#4F8FC6" />
        </>
      )}
    </g>
  );
}

/** HTML 裡用的奇異鳥頭像（背包卡、抽屜標題）。 */
export function KiwiAvatar({ scarf, accessory, bg = "#E3F7F0", size = 38 }: { scarf: string; accessory?: KiwiAccessory; bg?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-21 -37 50 50" aria-hidden="true" className="shrink-0">
      <circle cx={4} cy={-12} r={24} fill={bg} />
      <Kiwi x={0} y={0} scarf={scarf} accessory={accessory} />
    </svg>
  );
}

/** 推車：木箱＋兩個輪子＋錢袋＋送的人的圍巾色旗子。`alongGx` 時車身順著 gx 擺。 */
export function Cart({ P, gx, gy, flag, alongGx = false }: { P: Proj; gx: number; gy: number; flag: string; alongGx?: boolean }) {
  const w = alongGx ? 1.05 : 0.64;
  const d = alongGx ? 0.64 : 1.05;
  const x0 = gx - w / 2;
  const y0 = gy - d / 2;
  const wheels: [number, number][] = alongGx
    ? [[x0 + 0.25, y0 + d], [x0 + 0.8, y0 + d]]
    : [[x0 + w, y0 + 0.25], [x0 + w, y0 + 0.8]];
  const pole = P(x0 + 0.12, y0 + d - 0.12, 17);
  return (
    <g>
      <IsoBox P={P} gx={x0} gy={y0} w={w} d={d} h={11} faces={FACES.wood} z={6} />
      {wheels.map(([wx, wy], i) => {
        const [cx, cy] = P(wx, wy, 6);
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={4.6} ry={6.6} transform={`rotate(${alongGx ? 27 : -27} ${cx} ${cy})`} fill="#8A6A4A" />
            <circle cx={cx} cy={cy} r={1.6} fill="#F1E3C8" />
          </g>
        );
      })}
      {[[gx, gy + 0.22], [gx, gy - 0.22]].map(([sx, sy], i) => {
        const [x, y] = P(sx, sy, 17);
        return <path key={i} d={`M${x - 9} ${y + 2} q-2 -12 6 -14 l-2 -3 h10 l-2 3 q8 2 6 14z`} fill={TOWN.sack} />;
      })}
      <line x1={pole[0]} y1={pole[1]} x2={pole[0]} y2={pole[1] - 30} stroke={INK} strokeWidth={1.8} />
      <g transform={`translate(${pole[0]} ${pole[1] - 30})`}>
        <path className="town-wave" d="M0 0 q8 -3 16 2 q-8 4 -16 8z" fill={flag} />
      </g>
    </g>
  );
}
