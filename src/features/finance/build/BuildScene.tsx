"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { groundTransform, pointsAttr, projector, type Pt } from "../town/iso";
import { FACES, GROUND, INK, TOWN } from "../town/palette";
import { ArchL, Bush, Crate, FaceL, FaceR, Flowers, IsoBox, Kiwi, Marker, Pine, Poly, Rock, RoundTree } from "../town/sprites";
import { Bubble, CoinGlyph, NameTag, Scaled } from "../town/overlays";
import { TownDefs } from "../town/scenery";
import { OWNER_SCARF } from "../town/townView";
import { money } from "../format";
import { STAGE, type Stage } from "./stages";
import styles from "./build.module.css";

/**
 * 建城的小島：一塊一塊照答案長出來（設計稿「水庫建城（第一次設定）」，座標同
 * docs/finance-game/gen_setup.py）。每一塊標上「第幾步出現」，按下一步才落下來；
 * 正在問的那題，地上先畫橘色施工線。東西都是示意，數字以左邊的題目為準。
 */

export interface BuildPerson {
  key: string;
  name: string;
  scarf: string;
  pack: boolean;
  /** 第幾步出現：代收人 CUSTODY 答完、老師 TEACHERS 答完。 */
  from: Stage;
  /** 老師／助教／都是；不是老師的人 null。 */
  kindLabel: string | null;
  /** 期初代收的錢。 */
  amount: number | null;
}

export interface BuildSceneData {
  ownerName: string | null;
  ownerKindLabel: string | null;
  openLabel: string | null;
  balance: number;
  loan: number | null;
  /** 最多 4 位，站在廣場上。 */
  people: BuildPerson[];
  /** 最多 2 個：第一個蓋成房子、第二個蓋成教室。 */
  venues: { key: string; name: string; fee: string | null; payee: string | null }[];
  fundLabel: string;
}

const P = projector(410, 262);
const GT = groundTransform(410, 262);
const DONE = STAGE.DONE;
const SUB = "#76675A";
const ORANGE = TOWN.wait;

// 主堡、圍牆、門口
const K = { x: 1.6, y: 1.4, w: 2.2, d: 2.2, z: 8 };
const YARD = { x0: 0.8, x1: 6.2, y0: 0.8, y1: 4.8 };
const WALL_T = 0.26;
const WALL_H = 14;
const GATE = [2.2, 3.2] as const;
const BOSS = [2.7, 5.45] as const;
const FLAG = [3.7, 5.25] as const;
const POND = { x: 1.1, y: 3.85, w: 1.15, d: 0.65 };
const HOUSE = { x: 8.8, y: 1.2, w: 2.6, d: 2.4 };
const STUDIO = { x: 8.6, y: 7.2, w: 2.6, d: 2.2 };
const FLOOR = { x: 2.2, y: 9.5, w: 1.8, d: 1.4 };
const SLOTS = [[1.8, 8.3], [3.6, 8.1], [4.9, 9.0], [5.1, 10.5]] as const;
const ROADS = [[2.4, 4.8, 0.6, 1.1], [2.4, 5.9, 9.2, 0.7], [9.6, 3.6, 0.6, 2.3], [2.4, 6.6, 0.6, 0.7]] as const;
const ZR = K.z + 90;
const CRATE_CAP = 48;

const WALL_FACES = ["#F8DCC8", FACES.wall[1], FACES.wall[2]] as const;
const POLE = FACES.wood;

type Kind = "drop" | "pop" | "fade";

function Piece({ stage, from, to = DONE, kind = "drop", delay = 0, children }: { stage: Stage; from: number; to?: number; kind?: Kind; delay?: number; children: ReactNode }) {
  const on = stage >= from && stage <= to;
  return (
    <g className={cn(styles.pc, kind !== "fade" && styles[kind], on && styles.on)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </g>
  );
}

/** 只在問第 n 步時出現的施工線。 */
function Ghost({ stage, n, children }: { stage: Stage; n: number; children: ReactNode }) {
  return (
    <Piece stage={stage} from={n} to={n} kind="fade">
      <g className={styles.ghost}>{children}</g>
    </Piece>
  );
}

const ghostProps = { fill: ORANGE, fillOpacity: 0.14, stroke: ORANGE, strokeWidth: 0.07, strokeDasharray: ".28 .18" } as const;

function Tag({ x, y, label, fill, color }: { x: number; y: number; label: string; fill: string; color: string }) {
  const w = 14 + label.length * 13;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={20} rx={10} fill={fill} opacity={0.95} />
      <text x={x} y={y + 14.2} fontSize={12.5} fontWeight={700} textAnchor="middle" fill={color}>
        {label}
      </text>
    </g>
  );
}

function House({ x: hx, y: hy, w: hw, d: hd }: typeof HOUSE) {
  const hh = 40;
  const rh = 34;
  const ov = 0.2;
  const mid = hx + hw / 2;
  const front = hy + hd;
  const round = P(mid, front, hh + 14);
  return (
    <g>
      <IsoBox P={P} gx={hx} gy={hy} w={hw} d={hd} h={hh} faces={FACES.cream} />
      <FaceL P={P} gx0={hx + 0.8} gx1={hx + 1.4} gy={front} z0={0} z1={26} fill="#C98E5F" />
      <FaceL P={P} gx0={hx + 0.86} gx1={hx + 1.34} gy={front} z0={0} z1={24} fill="#D9A274" />
      {[0.12, 1.75].map((a) => (
        <g key={a}>
          <FaceL P={P} gx0={hx + a} gx1={hx + a + 0.6} gy={front} z0={13} z1={29} fill="#FFFFFF" />
          <FaceL P={P} gx0={hx + a + 0.07} gx1={hx + a + 0.53} gy={front} z0={15} z1={27} fill={TOWN.glass} />
          <FaceL P={P} gx0={hx + a} gx1={hx + a + 0.6} gy={front + 0.02} z0={10} z1={13} fill={TOWN.coral} />
        </g>
      ))}
      {[0.35, 1.45].map((a) => (
        <g key={a}>
          <FaceR P={P} gy0={hy + a} gy1={hy + a + 0.5} gx={hx + hw} z0={14} z1={30} fill="#FFFFFF" />
          <FaceR P={P} gy0={hy + a + 0.06} gy1={hy + a + 0.44} gx={hx + hw} z0={16} z1={28} fill={TOWN.glass} />
        </g>
      ))}
      <Poly ps={[P(hx - ov, hy, hh), P(hx - ov, front, hh), P(mid, front, hh + rh), P(mid, hy, hh + rh)]} fill={TOWN.coralLight} />
      <Poly ps={[P(hx, front, hh), P(hx + hw, front, hh), P(mid, front, hh + rh)]} fill={FACES.cream[1]} />
      <circle cx={round[0]} cy={round[1]} r={5} fill={TOWN.glass} stroke="#FFFFFF" strokeWidth={2} />
      <Poly ps={[P(hx + hw + ov, hy, hh), P(hx + hw + ov, front, hh), P(mid, front, hh + rh), P(mid, hy, hh + rh)]} fill={TOWN.coral} />
      <polyline points={pointsAttr([P(hx - ov, front, hh), P(mid, front, hh + rh), P(hx + hw + ov, front, hh)])} fill="none" stroke="#FFF6E6" strokeWidth={3} strokeLinejoin="round" />
      <IsoBox P={P} gx={hx + 0.4} gy={hy + 0.35} w={0.4} d={0.4} h={16} faces={FACES.chimney} z={hh + 12} />
    </g>
  );
}

function Studio({ x: cx, y: cy, w: cw, d: cd }: typeof STUDIO) {
  const ch = 44;
  const front = cy + cd;
  const sign = P(cx + 0.45, front, 40);
  return (
    <g>
      <IsoBox P={P} gx={cx} gy={cy} w={cw} d={cd} h={ch} faces={FACES.mint} />
      <FaceL P={P} gx0={cx + 0.5} gx1={cx + 1.2} gy={front} z0={0} z1={30} fill="#FFFFFF" />
      <FaceL P={P} gx0={cx + 0.56} gx1={cx + 1.14} gy={front} z0={0} z1={28} fill="#9CC6DA" />
      <FaceL P={P} gx0={cx + 1.5} gx1={cx + 2.35} gy={front} z0={10} z1={32} fill="#FFFFFF" />
      <FaceL P={P} gx0={cx + 1.56} gx1={cx + 2.29} gy={front} z0={12} z1={30} fill="#CDE9F1" />
      {[[0.3, 1.0], [1.3, 1.9]].map(([a, b]) => (
        <g key={a}>
          <FaceR P={P} gy0={cy + a} gy1={cy + b} gx={cx + cw} z0={12} z1={34} fill="#FFFFFF" />
          <FaceR P={P} gy0={cy + a + 0.06} gy1={cy + b - 0.06} gx={cx + cw} z0={14} z1={32} fill="#CDE9F1" />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = cx + 0.35 + ((cw - 0.6) * i) / 8;
        const b = cx + 0.35 + ((cw - 0.6) * (i + 1)) / 8;
        return <Poly key={i} ps={[P(a, front, 37), P(b, front, 37), P(b, front + 0.5, 30), P(a, front + 0.5, 30)]} fill={i % 2 === 0 ? TOWN.awning : "#FFFFFF"} />;
      })}
      <IsoBox P={P} gx={cx - 0.1} gy={cy - 0.1} w={cw + 0.2} d={cd + 0.2} h={6} faces={FACES.roofRim} z={ch} />
      <Poly ps={[P(cx + 0.15, cy + 0.15, ch + 6), P(cx + cw - 0.15, cy + 0.15, ch + 6), P(cx + cw - 0.15, cy + cd - 0.15, ch + 6), P(cx + 0.15, cy + cd - 0.15, ch + 6)]} fill="#E2DCCD" />
      <g transform={`translate(${sign[0].toFixed(1)} ${sign[1].toFixed(1)}) skewY(26.565)`}>
        <rect x={0} y={-12} width={64} height={12} rx={3} fill="#FFFFFF" />
        <text x={32} y={-2.4} fontSize={9.5} fontWeight={700} textAnchor="middle" fill="#3F7FA3" letterSpacing={2}>
          DANCE
        </text>
      </g>
    </g>
  );
}

type Item = { depth: number; node: ReactNode };

function sprites(stage: Stage, data: BuildSceneData): Item[] {
  const items: Item[] = [];
  const add = (depth: number, node: ReactNode) => items.push({ depth, node });
  const at = (from: number, node: ReactNode, opts: { to?: number; kind?: Kind; delay?: number } = {}) => (
    <Piece stage={stage} from={from} {...opts}>
      {node}
    </Piece>
  );

  // 裝飾
  for (const [gx, gy, h, s] of [[0.35, 6.4, 58, 0.95], [0.5, 11.4, 54, 0.9], [5.9, 11.5, 60, 1], [6.3, 9.4, 56, 0.9], [11.6, 0.5, 64, 1],
    [11.5, 4.6, 58, 0.95], [11.6, 11.2, 60, 1], [8.2, 11.4, 54, 0.9], [6.4, 0.4, 60, 0.95]]) {
    add(gx + gy, <Pine P={P} gx={gx} gy={gy} h={h} s={s} />);
  }
  add(9.7, <RoundTree P={P} gx={6.5} gy={3.2} s={0.8} />);
  add(13.9, <RoundTree P={P} gx={6.2} gy={7.7} s={0.75} />);
  add(19.9, <RoundTree P={P} gx={11.7} gy={8.2} s={0.8} blossom />);
  for (const [gx, gy, s] of [[0.4, 4.2, 0.8], [2.0, 6.95, 0.65], [11.7, 6.6, 0.8], [8.4, 4.6, 0.7], [4.6, 11.6, 0.8], [10.6, 11.3, 0.8]]) {
    add(gx + gy, <Bush P={P} gx={gx} gy={gy} s={s} />);
  }
  for (const [gx, gy, s] of [[6.6, 5.2, 0.8], [8.3, 10.4, 0.7], [11.8, 2.6, 0.8]]) add(gx + gy, <Rock P={P} gx={gx} gy={gy} s={s} />);
  for (const [gx, gy, c] of [[1.2, 10.9, "#FFFFFF"], [5.3, 10.6, "#F6B6C8"], [8.6, 5.3, "#FFFFFF"], [10.9, 10.8, "#F6B6C8"], [0.9, 6.9, "#FFFFFF"]] as const) {
    add(gx + gy - 1, <Flowers P={P} gx={gx} gy={gy} color={c} />);
  }

  // 廣場的舞池；開城時有人跳舞
  add(FLOOR.x + FLOOR.y + FLOOR.w + FLOOR.d - 0.5, (
    <g>
      <IsoBox P={P} gx={FLOOR.x} gy={FLOOR.y} w={FLOOR.w} d={FLOOR.d} h={5} faces={FACES.wood} />
      <g transform={groundTransform(410, 262, 5)}>
        <rect x={FLOOR.x} y={FLOOR.y} width={FLOOR.w} height={FLOOR.d} fill={TOWN.rug} />
        <rect x={FLOOR.x} y={FLOOR.y} width={FLOOR.w} height={FLOOR.d} fill="url(#town-check)" />
      </g>
    </g>
  ));
  const [d1, d2] = [P(FLOOR.x + 0.6, FLOOR.y + 0.5, 5), P(FLOOR.x + 1.3, FLOOR.y + 1.0, 5)];
  add(FLOOR.x + FLOOR.y + FLOOR.w + FLOOR.d - 0.4, at(DONE, (
    <>
      <g transform={`translate(${d1[0].toFixed(1)} ${d1[1].toFixed(1)})`}><g className="town-hop"><Kiwi x={0} y={0} s={0.62} scarf="#F2A7C3" /></g></g>
      <g transform={`translate(${d2[0].toFixed(1)} ${d2[1].toFixed(1)})`}><g className="town-hop town-delay"><Kiwi x={0} y={0} s={0.62} scarf={TOWN.coin} flip /></g></g>
    </>
  ), { kind: "pop" }));

  // 主堡：地基一直在，施工架到完工前
  add(3.9, <IsoBox P={P} gx={K.x - 0.12} gy={K.y - 0.12} w={K.w + 0.24} d={K.d + 0.24} h={K.z} faces={FACES.stone} />);
  add(3.95, at(0, (
    <>
      {[[K.x - 0.32, K.y - 0.32], [K.x + K.w + 0.14, K.y - 0.32], [K.x - 0.32, K.y + K.d + 0.14]].map(([x, y]) => (
        <IsoBox key={`${x}-${y}`} P={P} gx={x} gy={y} w={0.16} d={0.16} h={112} faces={POLE} z={K.z} />
      ))}
    </>
  ), { to: DONE - 1, kind: "fade" }));
  add(4.05, at(0, (
    <>
      <IsoBox P={P} gx={K.x + K.w + 0.14} gy={K.y + K.d + 0.14} w={0.16} d={0.16} h={112} faces={POLE} z={K.z} />
      {[K.z + 50, K.z + 96].map((z) => (
        <g key={z}>
          <FaceL P={P} gx0={K.x - 0.32} gx1={K.x + K.w + 0.3} gy={K.y + K.d + 0.3} z0={z} z1={z + 6} fill={FACES.wood[1]} />
          <FaceR P={P} gy0={K.y - 0.32} gy1={K.y + K.d + 0.3} gx={K.x + K.w + 0.3} z0={z} z1={z + 6} fill={FACES.wood[2]} />
        </g>
      ))}
    </>
  ), { to: DONE - 1, kind: "fade" }));
  add(9.0, at(0, (
    <>
      <IsoBox P={P} gx={4.4} gy={3.95} w={1.0} d={0.4} h={5} faces={FACES.wood} />
      <IsoBox P={P} gx={4.45} gy={4.0} w={0.9} d={0.35} h={5} faces={FACES.wood} z={5} />
    </>
  ), { to: STAGE.BALANCE, kind: "fade" }));

  add(4.0, at(STAGE.START, (
    <>
      <IsoBox P={P} gx={K.x} gy={K.y} w={K.w} d={K.d} h={40} faces={FACES.stone} z={K.z} />
      <ArchL P={P} gxc={K.x + 1.1} hw={0.38} gy={K.y + K.d} z0={K.z} zt={K.z + 22} hz={12} fill={TOWN.door} />
      <ArchL P={P} gxc={K.x + 1.1} hw={0.29} gy={K.y + K.d} z0={K.z} zt={K.z + 20} hz={9} fill={TOWN.doorLight} />
    </>
  )));
  add(4.01, at(STAGE.BALANCE, (
    <>
      <IsoBox P={P} gx={K.x} gy={K.y} w={K.w} d={K.d} h={40} faces={FACES.stone} z={K.z + 40} />
      {[K.x + 0.5, K.x + 1.7].map((wx) => (
        <ArchL key={wx} P={P} gxc={wx} hw={0.14} gy={K.y + K.d} z0={K.z + 52} zt={K.z + 64} hz={5} fill={TOWN.window} />
      ))}
      <FaceR P={P} gy0={K.y + 0.4} gy1={K.y + 0.7} gx={K.x + K.w} z0={K.z + 52} z1={K.z + 64} fill={TOWN.window} />
      <FaceR P={P} gy0={K.y + 1.4} gy1={K.y + 1.7} gx={K.x + K.w} z0={K.z + 52} z1={K.z + 64} fill={TOWN.window} />
      <Poly ps={[P(K.x + K.w, K.y + 0.8, K.z + 46), P(K.x + K.w, K.y + 1.3, K.z + 46), P(K.x + K.w, K.y + 1.3, K.z + 24), P(K.x + K.w, K.y + 1.05, K.z + 29), P(K.x + K.w, K.y + 0.8, K.z + 24)]} fill={TOWN.flag} />
      <IsoBox P={P} gx={K.x - 0.14} gy={K.y - 0.14} w={K.w + 0.28} d={K.d + 0.28} h={10} faces={FACES.battlement} z={K.z + 80} />
    </>
  )));
  const o = 0.2;
  const b0 = P(K.x - o, K.y - o, ZR);
  const b1 = P(K.x + K.w + o, K.y - o, ZR);
  const b2 = P(K.x + K.w + o, K.y + K.d + o, ZR);
  const b3 = P(K.x - o, K.y + K.d + o, ZR);
  const apex = P(K.x + K.w / 2, K.y + K.d / 2, ZR + 48);
  add(4.02, at(DONE, (
    <>
      <Poly ps={[b0, b1, apex]} fill={TOWN.keepRoof[0]} />
      <Poly ps={[b0, b3, apex]} fill={TOWN.keepRoof[0]} />
      <Poly ps={[b3, b2, apex]} fill={TOWN.keepRoof[1]} />
      <Poly ps={[b1, b2, apex]} fill={TOWN.keepRoof[2]} />
      <line x1={apex[0]} y1={apex[1]} x2={apex[0]} y2={apex[1] - 28} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <g transform={`translate(${apex[0]} ${apex[1] - 28})`}>
        <path className="town-wave" d="M0 0 q10 -3 20 2 q-10 4 -20 8z" fill={TOWN.flag} />
      </g>
    </>
  )));
  const dashed = (ps: Pt[], key: string) => (
    <polygon key={key} points={pointsAttr(ps)} fill={ORANGE} fillOpacity={0.1} stroke={ORANGE} strokeWidth={2} strokeDasharray="6 5" />
  );
  add(4.03, <Ghost stage={stage} n={STAGE.TRIAL}>{dashed([b3, b2, apex], "a")}{dashed([b1, b2, apex], "b")}</Ghost>);
  add(4.04, (
    <Ghost stage={stage} n={STAGE.START}>
      {dashed([P(K.x, K.y + K.d, K.z + 40), P(K.x + K.w, K.y + K.d, K.z + 40), P(K.x + K.w, K.y + K.d, K.z + 80), P(K.x, K.y + K.d, K.z + 80)], "l")}
      {dashed([P(K.x + K.w, K.y, K.z + 40), P(K.x + K.w, K.y + K.d, K.z + 40), P(K.x + K.w, K.y + K.d, K.z + 80), P(K.x + K.w, K.y, K.z + 80)], "r")}
    </Ghost>
  ));

  // 圍牆：一格一段，才能跟箱子正確前後遮擋
  const wall = (depth: number, gx: number, gy: number, w: number, d: number, delay: number) =>
    add(depth, at(STAGE.BALANCE, <IsoBox P={P} gx={gx} gy={gy} w={w} d={d} h={WALL_H} faces={WALL_FACES} />, { delay }));
  for (let gx = YARD.x0; gx < YARD.x1 - 1e-6; gx += 1) {
    const seg = Math.min(1, YARD.x1 - gx);
    wall(gx < K.x + K.w ? 3.5 + gx * 0.01 : 5 + gx * 0.01, gx, YARD.y0, seg, WALL_T, 40);
    wall(gx + seg + YARD.y1, gx, YARD.y1 - WALL_T, seg, WALL_T, 80);
  }
  for (let gy = YARD.y0; gy < YARD.y1 - 1e-6; gy += 1) {
    const seg = Math.min(1, YARD.y1 - gy);
    wall(3.4 + gy * 0.01, YARD.x0, gy, WALL_T, seg, 40);
    wall(YARD.x1 + gy + seg + 0.2, YARD.x1 - WALL_T, gy, WALL_T, seg, 80);
  }
  for (const [px, py] of [[YARD.x0, YARD.y0], [YARD.x1 - 0.4, YARD.y0], [YARD.x0, YARD.y1 - 0.4], [YARD.x1 - 0.4, YARD.y1 - 0.4], [GATE[0] - 0.4, YARD.y1 - 0.4], [GATE[1], YARD.y1 - 0.4]]) {
    add(py > YARD.y0 ? px + py + 0.9 : 3.45, at(STAGE.BALANCE, <IsoBox P={P} gx={px - 0.04} gy={py - 0.04} w={0.48} d={0.48} h={22} faces={FACES.post} />, { delay: 120 }));
  }
  for (const px of [GATE[0] - 0.2, GATE[1] + 0.2]) {
    const [lx, ly] = P(px, YARD.y1 - 0.16, 24);
    add(px + YARD.y1 + 1, at(DONE, (
      <>
        <circle cx={lx} cy={ly - 4} r={4.2} fill={TOWN.lamp} />
        <circle cx={lx} cy={ly - 4} r={8} fill={TOWN.lamp} opacity={0.35} />
      </>
    ), { kind: "fade" }));
  }

  // 開張旗
  const fp = P(...FLAG);
  add(8.95, at(STAGE.BALANCE, (
    <>
      <ellipse cx={fp[0]} cy={fp[1] + 1} rx={6} ry={2.5} fill={TOWN.shadow} opacity={0.2} />
      <line x1={fp[0]} y1={fp[1]} x2={fp[0]} y2={fp[1] - 52} stroke="#9C7A56" strokeWidth={3} strokeLinecap="round" />
      <g transform={`translate(${fp[0] + 1} ${fp[1] - 50})`}>
        <path className="town-wave" d="M0 0 q12 -3 24 3 q-12 5 -24 10z" fill={ORANGE} />
      </g>
    </>
  )));

  // 倉庫的箱子：1 箱 ≈ $1,000
  const crates = Math.min(CRATE_CAP, Math.max(0, Math.round(data.balance / 1000)));
  for (let n = 0; n < crates; n++) {
    const layer = Math.floor(n / 12);
    const i = n % 3;
    const j = Math.floor((n % 12) / 3);
    const gx = 3.9 + i * 0.66;
    const gy = 1.0 + j * 0.66;
    add(gx + gy + 0.62 + layer * 0.01, at(STAGE.LOAN, <Crate P={P} gx={gx} gy={gy} layer={layer} />, { delay: Math.min(800, 40 * (1 + Math.floor(n / 2))) }));
  }

  // 皇冠奇異鳥
  const [bx, by] = P(...BOSS);
  add(BOSS[0] + BOSS[1], at(STAGE.START, <Kiwi x={bx} y={by} s={1.1} scarf={OWNER_SCARF} accessory="crown" />));

  // 建城貸款看板
  if (data.loan) {
    add(7.7, at(STAGE.CUSTODY, (
      <>
        <IsoBox P={P} gx={0.7} gy={5.75} w={0.1} d={0.1} h={44} faces={FACES.wood} />
        <IsoBox P={P} gx={1.8} gy={5.75} w={0.1} d={0.1} h={44} faces={FACES.wood} />
        <FaceL P={P} gx0={0.6} gx1={2.0} gy={5.86} z0={20} z1={44} fill="#F3E3C6" />
        <FaceL P={P} gx0={0.6} gx1={2.0} gy={5.87} z0={20} z1={22} fill="#D9BE90" />
        <FaceL P={P} gx0={0.75} gx1={1.85} gy={5.88} z0={27} z1={33} fill={TOWN.growTrack} />
        <FaceL P={P} gx0={0.75} gx1={0.82} gy={5.89} z0={27} z1={33} fill={TOWN.grow} />
        <FaceL P={P} gx0={0.75} gx1={1.4} gy={5.88} z0={36} z1={40} fill="#D9BE90" />
      </>
    )));
  }

  // 水庫基金池
  add(POND.x + POND.y + POND.w + POND.d, at(STAGE.TRIAL, (
    <>
      <IsoBox P={P} gx={POND.x} gy={POND.y} w={POND.w} d={POND.d} h={7} faces={FACES.stone} />
      <g transform={groundTransform(410, 262, 7)}>
        <rect x={POND.x + 0.1} y={POND.y + 0.1} width={POND.w - 0.2} height={POND.d - 0.2} rx={0.12} fill="#5FBF98" />
        <rect x={POND.x + 0.25} y={POND.y + 0.22} width={0.35} height={0.06} fill="#FFFFFF" opacity={0.7} />
      </g>
    </>
  )));

  // 廣場上的人
  data.people.slice(0, SLOTS.length).forEach((person, i) => {
    const [gx, gy] = SLOTS[i];
    const [x, y] = P(gx, gy);
    add(gx + gy, at(person.from + 1, <Kiwi x={x} y={y} s={1} scarf={person.scarf} flip={i % 2 === 1} accessory={person.pack ? "pack" : undefined} />, { delay: i * 60 }));
  });

  // 上課的地方
  if (data.venues[0]) add(HOUSE.x + HOUSE.y + HOUSE.w + HOUSE.d, at(STAGE.VENUE_FEES, <House {...HOUSE} />));
  if (data.venues[1]) add(STUDIO.x + STUDIO.y + STUDIO.w + STUDIO.d, at(STAGE.VENUE_FEES, <Studio {...STUDIO} />, { delay: 120 }));

  // 路、橋、路標
  add(14.6, at(STAGE.FEES, (
    <>
      <IsoBox P={P} gx={6.85} gy={5.85} w={1.2} d={0.8} h={6} faces={FACES.wood} />
      {[1, 2, 3, 4, 5].map((k) => {
        const [x1, y1] = P(6.85 + k * 0.2, 5.85, 6);
        const [x2, y2] = P(6.85 + k * 0.2, 6.65, 6);
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CFA072" strokeWidth={1} />;
      })}
      <IsoBox P={P} gx={6.85} gy={5.85} w={1.2} d={0.1} h={8} faces={FACES.wood} z={6} />
      <IsoBox P={P} gx={6.85} gy={6.55} w={1.2} d={0.1} h={8} faces={FACES.wood} z={6} />
    </>
  ), { delay: 80 }));
  add(14.05, at(STAGE.FEES, <Marker P={P} gx={8.5} gy={5.55} />, { delay: 160 }));

  return items.sort((a, b) => a.depth - b.depth);
}

function Labels({ stage, data, k, compact }: { stage: Stage; data: BuildSceneData; k: number; compact: boolean }) {
  const label = (key: string, ax: number, ay: number, from: number, node: ReactNode, opts: { to?: number; wide?: boolean } = {}) =>
    compact && opts.wide ? null : (
      <Piece key={key} stage={stage} from={from} to={opts.to} kind="pop">
        <Scaled ax={ax} ay={ay} k={k}>{node}</Scaled>
      </Piece>
    );
  const [bx, by] = P(...BOSS);
  const fp = P(...FLAG);
  const lp = P(1.3, 5.86, 50);
  const hp = P(HOUSE.x + HOUSE.w / 2, HOUSE.y + HOUSE.d / 2, 88);
  const cp = P(STUDIO.x + STUDIO.w / 2, STUDIO.y + STUDIO.d / 2, 56);
  const pp = P(POND.x + POND.w / 2, POND.y + POND.d / 2, 14);
  const kp = P(K.x + K.w / 2, K.y + K.d / 2, ZR + 48 + 34);
  const role = { fill: "#EAF1FB", color: "#34609C" };

  return (
    <>
      {data.ownerName && label("boss", bx, by + 8, STAGE.START, <NameTag x={bx} y={by + 8} label={data.ownerName} />)}
      {data.ownerKindLabel && label("bossKind", bx, by + 30, STAGE.TEACHERS + 1, <Tag x={bx} y={by + 30} label={data.ownerKindLabel} {...role} />, { wide: true })}
      {data.openLabel && label("open", fp[0], fp[1] + 6, STAGE.BALANCE, <Tag x={fp[0]} y={fp[1] + 6} label={data.openLabel} fill={TOWN.waitBg} color="#9A5208" />, { wide: true })}
      {data.loan && label("loan", lp[0], lp[1], STAGE.CUSTODY, (
        <Bubble cx={lp[0]} bottom={lp[1]} w={124} h={42}>
          <text x={14} y={17} fontSize={11} fontWeight={700} fill={SUB}>建城貸款</text>
          <text x={14} y={34} fontSize={16} fontWeight={600} fill={INK}>{money(data.loan)}</text>
        </Bubble>
      ), { to: STAGE.TEACHERS, wide: true })}
      {data.people.slice(0, SLOTS.length).map((person, i) => {
        const [x, y] = P(SLOTS[i][0], SLOTS[i][1]);
        return (
          <g key={person.key}>
            {label(`n${person.key}`, x, y + 6, person.from + 1, <NameTag x={x} y={y + 6} label={person.name} />)}
            {person.kindLabel && label(`k${person.key}`, x, y + 28, STAGE.TEACHERS + 1, <Tag x={x} y={y + 28} label={person.kindLabel} {...role} />, { wide: true })}
            {person.amount
              ? label(`a${person.key}`, x, y - 44, STAGE.KEEP_DONE, (
                  <Bubble cx={x + 2} bottom={y - 44} w={112} h={34}>
                    <CoinGlyph x={20} y={17} />
                    <text x={36} y={23.5} fontSize={17} fontWeight={600} fill={INK}>{money(person.amount)}</text>
                  </Bubble>
                ), { to: STAGE.TEACHERS, wide: true })
              : null}
          </g>
        );
      })}
      {data.venues.map((venue, i) => {
        const [x, y] = i === 0 ? hp : cp;
        const top = y - (i === 0 ? 24 : 22);
        return (
          <g key={venue.key}>
            {label(`v${venue.key}`, x, top, STAGE.VENUE_FEES, <NameTag x={x} y={top} label={venue.name} />)}
            {venue.fee && label(`f${venue.key}`, x, top - 6, STAGE.PAY, (
              <Bubble cx={x} bottom={top - 6} w={64 + (venue.fee.length + (venue.payee?.length ?? 0)) * 11} h={34}>
                <CoinGlyph x={18} y={17} />
                <text x={34} y={23} fontSize={15} fontWeight={600} fill={INK}>{venue.fee}</text>
                {venue.payee && (
                  <text x={44 + venue.fee.length * 9} y={22} fontSize={11.5} fontWeight={700} fill={SUB}>{venue.payee}</text>
                )}
              </Bubble>
            ), { to: STAGE.TRIAL, wide: true })}
          </g>
        );
      })}
      {label("pond", pp[0], pp[1], STAGE.TRIAL, (
        <Bubble cx={pp[0]} bottom={pp[1]} w={20 + Math.max(4, data.fundLabel.length) * 13} h={42}>
          <text x={14} y={17} fontSize={11} fontWeight={700} fill={SUB}>水庫基金</text>
          <text x={14} y={34} fontSize={15} fontWeight={600} fill={INK}>{data.fundLabel}</text>
        </Bubble>
      ))}
      {label("keep", kp[0], kp[1], DONE, (
        <Bubble cx={kp[0]} bottom={kp[1]} w={136} h={42}>
          <text x={16} y={18} fontSize={11} fontWeight={700} fill={SUB}>主堡財庫</text>
          <text x={16} y={35} fontSize={18} fontWeight={600} fill={INK}>{money(data.balance)}</text>
        </Bubble>
      ))}
    </>
  );
}

/** 開城：錢沿著路流回主堡。 */
function Flow({ stage, venues }: { stage: Stage; venues: number }) {
  const path = (pts: [number, number][]) => "M" + pts.map(([gx, gy]) => P(gx, gy, 10).map((v) => v.toFixed(1)).join(" ")).join(" L");
  const routes = [
    path([[9.9, 3.8], [9.9, 6.25], [2.7, 6.25], [2.7, 4.9]]),
    ...(venues > 1 ? [path([[9.6, 7.1], [9.6, 6.25], [2.7, 6.25], [2.7, 4.9]])] : []),
  ];
  return (
    <Piece stage={stage} from={DONE} kind="fade">
      <g className={styles.flow}>
        {[0, 1, 2].map((i) => (
          <g key={i} opacity={0}>
            <CoinGlyph x={0} y={0} r={7} />
            <animateMotion dur="4.2s" begin={`${i * 1.4}s`} repeatCount="indefinite" path={routes[i % routes.length]} />
            <animate attributeName="opacity" dur="4.2s" begin={`${i * 1.4}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.1;.85;1" />
          </g>
        ))}
      </g>
    </Piece>
  );
}

export default function BuildScene({ stage, data, compact }: { stage: Stage; data: BuildSceneData; compact: boolean }) {
  const k = compact ? 2.2 : 1;
  return (
    <svg viewBox="10 96 800 584" className="block size-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="建城中的小鎮：答一題，主堡和小鎮就多蓋一塊">
      <TownDefs />
      <IsoBox P={P} gx={0} gy={0} w={12} d={12} h={18} faces={[GROUND, "#CDB58C", "#B59B74"]} z={-18} />
      <g transform={GT}>
        {[[10.6, 10.9, 1.0, TOWN.grassDark], [11.0, 5.0, 0.8, TOWN.grassLight], [0.9, 6.9, 0.7, TOWN.grassLight], [8.2, 4.6, 0.8, TOWN.grassDark], [5.4, 11.0, 0.8, TOWN.grassLight]].map(([x, y, r, c]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c as string} />
        ))}
        <rect x={0.9} y={7.3} width={4.9} height={3.9} rx={0.5} fill={TOWN.garden} />
        <rect x={6.85} y={0} width={1.2} height={12} fill={TOWN.bank} />
        <rect x={7.0} y={0} width={0.9} height={12} fill={TOWN.water} />
        <Piece stage={stage} from={0} to={STAGE.START} kind="fade">
          <rect x={YARD.x0} y={YARD.y0} width={YARD.x1 - YARD.x0} height={YARD.y1 - YARD.y0} rx={0.3} fill={TOWN.grassLight} stroke="#B98858" strokeWidth={0.07} strokeDasharray=".35 .25" />
        </Piece>
        <Piece stage={stage} from={STAGE.BALANCE} kind="fade">
          <rect x={YARD.x0} y={YARD.y0} width={YARD.x1 - YARD.x0} height={YARD.y1 - YARD.y0} rx={0.2} fill={TOWN.plaza} />
          <rect x={YARD.x0} y={YARD.y0} width={YARD.x1 - YARD.x0} height={YARD.y1 - YARD.y0} rx={0.2} fill="url(#town-pave)" />
          <rect x={3.8} y={0.95} width={2.15} height={2.75} fill={TOWN.yard} />
        </Piece>
        <Piece stage={stage} from={STAGE.FEES} kind="fade">
          {ROADS.map(([x, y, w, h]) => <rect key={`e${x}-${y}`} x={x - 0.08} y={y - 0.08} width={w + 0.16} height={h + 0.16} rx={0.3} fill={TOWN.roadEdge} />)}
          {ROADS.map(([x, y, w, h]) => <rect key={`r${x}-${y}`} x={x} y={y} width={w} height={h} rx={0.25} fill={TOWN.road} />)}
        </Piece>
        <Ghost stage={stage} n={STAGE.OWNER}><circle cx={BOSS[0]} cy={BOSS[1]} r={0.55} {...ghostProps} /></Ghost>
        <Ghost stage={stage} n={STAGE.BALANCE}><rect x={3.8} y={0.95} width={2.15} height={2.75} rx={0.2} {...ghostProps} /></Ghost>
        <Ghost stage={stage} n={STAGE.LOAN}><rect x={0.6} y={5.55} width={1.5} height={0.55} rx={0.2} {...ghostProps} /></Ghost>
        <Ghost stage={stage} n={STAGE.CUSTODY}><circle cx={SLOTS[0][0]} cy={SLOTS[0][1]} r={0.55} {...ghostProps} /></Ghost>
        <Ghost stage={stage} n={STAGE.TEACHERS}>
          {SLOTS.slice(1, 3).map(([x, y]) => <circle key={x} cx={x} cy={y} r={0.55} {...ghostProps} />)}
        </Ghost>
        <Ghost stage={stage} n={STAGE.PLACES}>
          <rect x={HOUSE.x} y={HOUSE.y} width={HOUSE.w} height={HOUSE.d} rx={0.2} {...ghostProps} />
          <rect x={STUDIO.x} y={STUDIO.y} width={STUDIO.w} height={STUDIO.d} rx={0.2} {...ghostProps} />
        </Ghost>
        <Ghost stage={stage} n={STAGE.PAY}>
          {ROADS.map(([x, y, w, h]) => <rect key={`g${x}-${y}`} x={x} y={y} width={w} height={h} rx={0.25} {...ghostProps} />)}
        </Ghost>
        <Ghost stage={stage} n={STAGE.FEES}><rect x={POND.x} y={POND.y} width={POND.w} height={POND.d} rx={0.2} {...ghostProps} /></Ghost>
      </g>
      {sprites(stage, data).map((item, i) => <g key={i}>{item.node}</g>)}
      <Labels stage={stage} data={data} k={k} compact={compact} />
      {!compact && <Flow stage={stage} venues={data.venues.length} />}
    </svg>
  );
}
