/**
 * 地圖上不會動的東西：地面（路、河、麥田）、建築、樹。
 * 立體物件回傳成「深度＋節點」，跟會動的角色、推車一起依 gx + gy 排序後再畫（style doc §3.1）。
 */

import type { ReactNode } from "react";
import { groundTransform, pointsAttr, type Proj } from "./iso";
import type { TownLayout } from "./layouts";
import { FACES, INK, TOWN } from "./palette";
import { ArchL, Bush, FaceL, FaceR, Flowers, IsoBox, Kiwi, Marker, Pine, Poly, Rock, RoundTree } from "./sprites";

export interface DepthItem {
  key: string;
  depth: number;
  node: ReactNode;
}

/** 這張地圖用到的花紋與陰影；整頁只會有一張地圖，id 不會重複。 */
export function TownDefs() {
  return (
    <defs>
      <filter id="town-soft" x="-20%" y="-30%" width="140%" height="170%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor={INK} floodOpacity=".18" />
      </filter>
      <pattern id="town-check" width=".5" height=".5" patternUnits="userSpaceOnUse">
        <rect width=".25" height=".25" fill="#FFFFFF" opacity=".75" />
        <rect x=".25" y=".25" width=".25" height=".25" fill="#FFFFFF" opacity=".75" />
      </pattern>
      <pattern id="town-pave" width="1" height="1" patternUnits="userSpaceOnUse">
        <path d="M0 0H1M0 0V1" stroke={TOWN.plazaLine} strokeWidth=".035" fill="none" />
      </pattern>
      <pattern id="town-wheat" width="1" height=".4" patternUnits="userSpaceOnUse">
        <rect y=".25" width="1" height=".1" fill={TOWN.wheatRow} />
      </pattern>
      <pattern id="town-stripe" width="12" height="8" patternUnits="userSpaceOnUse">
        <rect width="12" height="8" fill={TOWN.wait} />
        <path d="M0 8 6 0h4l-6 8z" fill="#F7BD6A" />
        <animateTransform attributeName="patternTransform" type="translate" values="0 0;12 0" dur="1s" repeatCount="indefinite" />
      </pattern>
    </defs>
  );
}

/** 地上的平面：草地色塊、廣場、倉庫地面、河、麥田、路。全部用格子座標畫在一個變形群組裡。 */
export function GroundLayer({ layout }: { layout: TownLayout }) {
  const { ground, yard } = layout;
  const [ox, oy] = layout.origin;
  const [gx, gy, gw, gh] = ground.garden;
  const [px, py, pw, ph] = ground.plaza;
  const [wx, wy, ww, wh] = ground.wheat;
  const river = ground.river;
  return (
    <g transform={groundTransform(ox, oy)}>
      {ground.patches.map(([cx, cy, r, light], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={light ? TOWN.grassLight : TOWN.grassDark} />
      ))}
      <rect x={gx} y={gy} width={gw} height={gh} rx={1.5} fill={TOWN.garden} />
      <rect x={px} y={py} width={pw} height={ph} rx={1} fill={TOWN.plaza} />
      <rect x={px} y={py} width={pw} height={ph} rx={1} fill="url(#town-pave)" />
      <rect x={yard.x0} y={yard.y0} width={yard.x1 - yard.x0} height={yard.y1 - yard.y0} fill={TOWN.yard} />
      <rect x={-20} y={river.y - 0.2} width={60} height={1.6} rx={0.6} fill={TOWN.bank} />
      {river.pool && <circle cx={river.pool[0]} cy={river.pool[1]} r={2.25} fill={TOWN.bank} />}
      <rect x={-20} y={river.y} width={60} height={1.2} rx={0.5} fill={TOWN.water} />
      {river.pool && (
        <>
          <circle cx={river.pool[0]} cy={river.pool[1]} r={2} fill={TOWN.water} />
          <circle cx={river.pool[0]} cy={river.pool[1]} r={1.1} fill={TOWN.waterDeep} />
        </>
      )}
      <g opacity={0.7}>
        {ground.ripples.map(([rx, ry], i) => (
          <rect key={i} x={rx} y={ry} width={1.3} height={0.08} fill="#FFFFFF">
            <animateTransform attributeName="transform" type="translate" values="0 0;1.1 0;0 0" dur={`${4 + (i % 3)}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      {ground.lilies.map(([lx, ly], i) => (
        <g key={i}>
          <circle cx={lx} cy={ly} r={0.26} fill="#9CC67A" />
          <circle cx={lx + 0.12} cy={ly - 0.05} r={0.07} fill="#F6B6C8" />
        </g>
      ))}
      <rect x={wx} y={wy} width={ww} height={wh} rx={0.2} fill={TOWN.wheat} />
      <rect x={wx} y={wy} width={ww} height={wh} rx={0.2} fill="url(#town-wheat)" />
      {ground.roads.map(({ path, width }, i) => {
        const points = path.map(([x, y]) => `${x},${y}`).join(" ");
        return (
          <g key={i} fill="none" strokeLinejoin="round" strokeLinecap="round">
            <polyline points={points} stroke={TOWN.roadEdge} strokeWidth={width + 0.18} />
            <polyline points={points} stroke={TOWN.road} strokeWidth={width} />
          </g>
        );
      })}
    </g>
  );
}

/** 主堡：石塔＋拱門＋綠色布旗＋青綠尖屋頂＋飄動的旗子。 */
function Keep({ P, layout }: { P: Proj; layout: TownLayout }) {
  const { gx, gy, size: s, height: h, roof } = layout.keep;
  const front = gy + s;
  const o = 0.2;
  const apex = P(gx + s / 2, gy + s / 2, h + 10 + roof);
  const b0 = P(gx - o, gy - o, h + 10);
  const b1 = P(gx + s + o, gy - o, h + 10);
  const b2 = P(gx + s + o, gy + s + o, h + 10);
  const b3 = P(gx - o, gy + s + o, h + 10);
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={s} d={s} h={h} faces={FACES.stone} />
      <ArchL P={P} gxc={gx + s / 2} hw={0.34} gy={front} z0={0} zt={h * 0.27} hz={11} fill={TOWN.door} />
      <ArchL P={P} gxc={gx + s / 2} hw={0.26} gy={front} z0={0} zt={h * 0.25} hz={8.5} fill={TOWN.doorLight} />
      {[gx + s * 0.18, gx + s * 0.68].map((wx, i) => (
        <ArchL key={i} P={P} gxc={wx + 0.13} hw={0.13} gy={front} z0={h * 0.6} zt={h * 0.75} hz={5} fill={TOWN.window} />
      ))}
      <FaceR P={P} gy0={gy + s * 0.18} gy1={gy + s * 0.33} gx={gx + s} z0={h * 0.6} z1={h * 0.75} fill={TOWN.window} />
      <FaceR P={P} gy0={gy + s * 0.6} gy1={gy + s * 0.75} gx={gx + s} z0={h * 0.6} z1={h * 0.75} fill={TOWN.window} />
      <Poly
        ps={[P(gx + s, gy + s * 0.33, h * 0.5), P(gx + s, gy + s * 0.68, h * 0.5), P(gx + s, gy + s * 0.68, h * 0.18), P(gx + s, gy + s * 0.5, h * 0.25), P(gx + s, gy + s * 0.33, h * 0.18)]}
        fill={TOWN.flag}
      />
      <IsoBox P={P} gx={gx - 0.14} gy={gy - 0.14} w={s + 0.28} d={s + 0.28} h={10} faces={FACES.battlement} z={h} />
      <Poly ps={[b0, b1, apex]} fill={TOWN.keepRoof[0]} />
      <Poly ps={[b0, b3, apex]} fill={TOWN.keepRoof[0]} />
      <Poly ps={[b3, b2, apex]} fill={TOWN.keepRoof[1]} />
      <Poly ps={[b1, b2, apex]} fill={TOWN.keepRoof[2]} />
      <line x1={apex[0]} y1={apex[1]} x2={apex[0]} y2={apex[1] - 26} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <g transform={`translate(${apex[0]} ${apex[1] - 26})`}>
        <path className="town-wave" d="M0 0 q9 -3 18 2 q-9 4 -18 8z" fill={TOWN.flag} />
      </g>
    </g>
  );
}

/** 主堡的圍牆：拆成一格一段，才能跟箱子、推車正確前後遮擋。門口留空、兩邊各一盞燈。 */
function yardItems(P: Proj, layout: TownLayout): DepthItem[] {
  const { x0, x1, y0, y1, gate } = layout.yard;
  const T = 0.26;
  const H = 14;
  const items: DepthItem[] = [];
  for (let gx = x0; gx < x1 - 1e-6; gx += 1) {
    const seg = Math.min(1, x1 - gx);
    items.push({ key: `wb${gx}`, depth: gx + y0 + 0.1, node: <IsoBox P={P} gx={gx} gy={y0} w={seg} d={T} h={H} faces={FACES.wall} /> });
    if (!(gx + seg > gate[0] && gx < gate[1])) {
      items.push({ key: `wf${gx}`, depth: gx + seg + y1 + 0.2, node: <IsoBox P={P} gx={gx} gy={y1 - T} w={seg} d={T} h={H} faces={FACES.wall} /> });
    }
  }
  for (let gy = y0; gy < y1 - 1e-6; gy += 1) {
    const seg = Math.min(1, y1 - gy);
    items.push({ key: `wl${gy}`, depth: x0 + gy + 0.1, node: <IsoBox P={P} gx={x0} gy={gy} w={T} d={seg} h={H} faces={FACES.wall} /> });
    items.push({ key: `wr${gy}`, depth: x1 + gy + seg + 0.2, node: <IsoBox P={P} gx={x1 - T} gy={gy} w={T} d={seg} h={H} faces={FACES.wall} /> });
  }
  const posts: [number, number][] = [
    [x0, y0], [x1 - 0.4, y0], [x0, y1 - 0.4], [x1 - 0.4, y1 - 0.4], [gate[0] - 0.25, y1 - 0.4], [gate[1] - 0.05, y1 - 0.4],
  ];
  for (const [px, py] of posts) {
    items.push({ key: `p${px}-${py}`, depth: px + py + 0.9, node: <IsoBox P={P} gx={px - 0.04} gy={py - 0.04} w={0.48} d={0.48} h={22} faces={FACES.post} /> });
  }
  for (const px of [gate[0] - 0.05, gate[1] + 0.15]) {
    const [lx, ly] = P(px, y1 - 0.16, 24);
    items.push({
      key: `lamp${px}`,
      depth: px + y1 + 1,
      node: (
        <g>
          <circle cx={lx} cy={ly - 4} r={8} fill={TOWN.lamp} opacity={0.35} />
          <circle cx={lx} cy={ly - 4} r={4.2} fill={TOWN.lamp} />
        </g>
      ),
    });
  }
  return items;
}

/** 租的教室：薄荷綠牆、藍白遮陽棚、平屋頂。 */
function Classroom({ P, layout }: { P: Proj; layout: TownLayout }) {
  const { gx, gy, w, d, h, door, window: win, sideWindows, awning, sign } = layout.classroom;
  const front = gy + d;
  const stripes = 8;
  const signAt = P(awning[0] + 0.05, front, h - 6);
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={w} d={d} h={h} faces={FACES.mint} />
      <FaceL P={P} gx0={door[0]} gx1={door[1]} gy={front} z0={0} z1={h * 0.65} fill="#FFFFFF" />
      <FaceL P={P} gx0={door[0] + 0.07} gx1={door[1] - 0.07} gy={front} z0={0} z1={h * 0.6} fill="#9CC6DA" />
      <FaceL P={P} gx0={win[0]} gx1={win[1]} gy={front} z0={h * 0.22} z1={h * 0.7} fill="#FFFFFF" />
      <FaceL P={P} gx0={win[0] + 0.07} gx1={win[1] - 0.07} gy={front} z0={h * 0.26} z1={h * 0.66} fill="#CDE9F1" />
      {sideWindows.map(([a, b], i) => (
        <g key={i}>
          <FaceR P={P} gy0={a} gy1={b} gx={gx + w} z0={h * 0.26} z1={h * 0.74} fill="#FFFFFF" />
          <FaceR P={P} gy0={a + 0.06} gy1={b - 0.06} gx={gx + w} z0={h * 0.3} z1={h * 0.7} fill="#CDE9F1" />
        </g>
      ))}
      {Array.from({ length: stripes }, (_, i) => {
        const a = awning[0] + ((awning[1] - awning[0]) * i) / stripes;
        const b = awning[0] + ((awning[1] - awning[0]) * (i + 1)) / stripes;
        return (
          <Poly
            key={i}
            ps={[P(a, front, h * 0.83), P(b, front, h * 0.83), P(b, front + 0.55, h * 0.68), P(a, front + 0.55, h * 0.68)]}
            fill={i % 2 === 0 ? TOWN.awning : "#FFFFFF"}
          />
        );
      })}
      <IsoBox P={P} gx={gx - 0.1} gy={gy - 0.1} w={w + 0.2} d={d + 0.2} h={6} faces={FACES.roofRim} z={h} />
      <Poly ps={[P(gx + 0.15, gy + 0.15, h + 6), P(gx + w - 0.15, gy + 0.15, h + 6), P(gx + w - 0.15, gy + d - 0.15, h + 6), P(gx + 0.15, gy + d - 0.15, h + 6)]} fill="#E2DCCD" />
      <IsoBox P={P} gx={gx + w * 0.7} gy={gy + 0.5} w={0.5} d={0.5} h={8} faces={FACES.vent} z={h + 6} />
      {sign && (
        <g transform={`translate(${signAt[0].toFixed(1)} ${signAt[1].toFixed(1)}) skewY(26.565)`}>
          <rect x={0} y={-12} width={70} height={12} rx={3} fill="#FFFFFF" />
          <text x={35} y={-2.4} fontSize={9.5} fontWeight={700} textAnchor="middle" fill="#4D8FB3" letterSpacing={2}>
            DANCE
          </text>
        </g>
      )}
    </g>
  );
}

/** 台南丁丁家：奶油色牆、珊瑚色人字屋頂、圓窗、煙囪。 */
function House({ P, layout }: { P: Proj; layout: TownLayout }) {
  const { gx, gy, door, sideWindows, frontWindows, chimney } = layout.house;
  const w = 3;
  const d = 3;
  const h = 42;
  const rh = 36;
  const ov = 0.22;
  const mid = gx + w / 2;
  const front = gy + d;
  const round = P(mid, front, h + 15);
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={w} d={d} h={h} faces={FACES.cream} />
      <FaceR P={P} gy0={door[0]} gy1={door[1]} gx={gx + w} z0={0} z1={27} fill="#C98E5F" />
      <FaceR P={P} gy0={door[0] + 0.08} gy1={door[1] - 0.08} gx={gx + w} z0={0} z1={25} fill="#D9A274" />
      {sideWindows.map(([a, b], i) => (
        <g key={`s${i}`}>
          <FaceR P={P} gy0={a} gy1={b} gx={gx + w} z0={15} z1={30} fill="#FFFFFF" />
          <FaceR P={P} gy0={a + 0.07} gy1={b - 0.07} gx={gx + w} z0={17} z1={28} fill={TOWN.glass} />
        </g>
      ))}
      {frontWindows.map(([a, b], i) => (
        <g key={`f${i}`}>
          <FaceL P={P} gx0={a} gx1={b} gy={front} z0={14} z1={30} fill="#FFFFFF" />
          <FaceL P={P} gx0={a + 0.08} gx1={b - 0.08} gy={front} z0={16} z1={28} fill={TOWN.glass} />
          <FaceL P={P} gx0={a} gx1={b} gy={front + 0.02} z0={11} z1={14} fill={TOWN.coral} />
        </g>
      ))}
      <Poly ps={[P(gx - ov, gy, h), P(gx - ov, front, h), P(mid, front, h + rh), P(mid, gy, h + rh)]} fill={TOWN.coralLight} />
      <Poly ps={[P(gx, front, h), P(gx + w, front, h), P(mid, front, h + rh)]} fill={FACES.cream[1]} />
      <circle cx={round[0]} cy={round[1]} r={5} fill={TOWN.glass} stroke="#FFFFFF" strokeWidth={2} />
      <Poly ps={[P(gx + w + ov, gy, h), P(gx + w + ov, front, h), P(mid, front, h + rh), P(mid, gy, h + rh)]} fill={TOWN.coral} />
      <polyline
        points={pointsAttr([P(gx - ov, front, h), P(mid, front, h + rh), P(gx + w + ov, front, h)])}
        fill="none"
        stroke="#FFF6E6"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <IsoBox P={P} gx={chimney[0]} gy={chimney[1]} w={0.45} d={0.45} h={18} faces={FACES.chimney} z={h + 14} />
    </g>
  );
}

/** 台南的舞蹈地板：粉色格紋地墊，上面兩隻奇異鳥在跳舞（裝飾）。 */
function DanceFloor({ P, layout }: { P: Proj; layout: TownLayout }) {
  const { gx, gy, w, d, dancers } = layout.floor;
  const [ox, oy] = layout.origin;
  const [a, b] = dancers.map(([x, y]) => P(x, y, 5));
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={w} d={d} h={5} faces={FACES.wood} />
      <g transform={groundTransform(ox, oy, 5)}>
        <rect x={gx} y={gy} width={w} height={d} fill={TOWN.rug} />
        <rect x={gx} y={gy} width={w} height={d} fill="url(#town-check)" />
      </g>
      <g transform={`translate(${a[0].toFixed(1)} ${a[1].toFixed(1)})`}>
        <g className="town-hop">
          <Kiwi x={0} y={0} s={0.62} scarf="#F2A7C3" />
        </g>
      </g>
      <g transform={`translate(${b[0].toFixed(1)} ${b[1].toFixed(1)})`}>
        <g className="town-hop town-delay">
          <Kiwi x={0} y={0} s={0.62} scarf={TOWN.coin} flip />
        </g>
      </g>
    </g>
  );
}

function Bridge({ P, layout }: { P: Proj; layout: TownLayout }) {
  const { gx, gy, w, d } = layout.bridge;
  return (
    <g>
      <IsoBox P={P} gx={gx} gy={gy} w={w} d={d} h={6} faces={FACES.wood} />
      {Array.from({ length: 7 }, (_, k) => {
        const y = gy + ((k + 1) * d) / 8;
        const [x1, y1] = P(gx, y, 6);
        const [x2, y2] = P(gx + w, y, 6);
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CFA072" strokeWidth={1} />;
      })}
      <IsoBox P={P} gx={gx} gy={gy} w={0.1} d={d} h={8} faces={FACES.wood} z={6} />
      <IsoBox P={P} gx={gx + w - 0.1} gy={gy} w={0.1} d={d} h={8} faces={FACES.wood} z={6} />
    </g>
  );
}

/** 所有不會動的立體物件。結果只跟版面有關，呼叫端記得 memo。 */
export function staticItems(P: Proj, layout: TownLayout): DepthItem[] {
  const { decor, keep, classroom, house, floor, bridge } = layout;
  const items: DepthItem[] = [];
  decor.pines.forEach(([gx, gy, h, s], i) => items.push({ key: `pine${i}`, depth: gx + gy, node: <Pine P={P} gx={gx} gy={gy} h={h} s={s} /> }));
  decor.apples.forEach(([gx, gy, s], i) => items.push({ key: `apple${i}`, depth: gx + gy, node: <RoundTree P={P} gx={gx} gy={gy} s={s} fruit /> }));
  decor.trees.forEach(([gx, gy, s], i) => items.push({ key: `tree${i}`, depth: gx + gy, node: <RoundTree P={P} gx={gx} gy={gy} s={s} /> }));
  decor.blossoms.forEach(([gx, gy, s], i) => items.push({ key: `blossom${i}`, depth: gx + gy, node: <RoundTree P={P} gx={gx} gy={gy} s={s} blossom /> }));
  decor.bushes.forEach(([gx, gy, s], i) => items.push({ key: `bush${i}`, depth: gx + gy, node: <Bush P={P} gx={gx} gy={gy} s={s} /> }));
  decor.rocks.forEach(([gx, gy, s], i) => items.push({ key: `rock${i}`, depth: gx + gy, node: <Rock P={P} gx={gx} gy={gy} s={s} /> }));
  decor.flowers.forEach(([gx, gy, c], i) => items.push({ key: `flower${i}`, depth: gx + gy - 1, node: <Flowers P={P} gx={gx} gy={gy} color={c} /> }));
  decor.markers.forEach(([gx, gy], i) => items.push({ key: `marker${i}`, depth: gx + gy, node: <Marker P={P} gx={gx} gy={gy} /> }));
  items.push({ key: "keep", depth: keep.gx + keep.gy + keep.size * 0.9, node: <Keep P={P} layout={layout} /> });
  items.push(...yardItems(P, layout));
  items.push({ key: "classroom", depth: classroom.gx + classroom.gy + (classroom.w + classroom.d) / 2, node: <Classroom P={P} layout={layout} /> });
  items.push({ key: "house", depth: house.gx + house.gy + 3, node: <House P={P} layout={layout} /> });
  items.push({ key: "floor", depth: floor.gx + floor.gy + (floor.w + floor.d) / 2, node: <DanceFloor P={P} layout={layout} /> });
  items.push({ key: "bridge", depth: bridge.gx + bridge.gy + (bridge.w + bridge.d) / 2, node: <Bridge P={P} layout={layout} /> });
  return items;
}

/** 箱子要放的格位：先鋪滿每一堆的第一層，再往上疊，最多三層。 */
export function crateSlots(layout: TownLayout): { gx: number; gy: number; layer: number }[] {
  const slots: { gx: number; gy: number; layer: number }[] = [];
  for (let layer = 0; layer < 3; layer++) {
    for (const pile of layout.piles) {
      for (let j = 0; j < pile.ny; j++) {
        for (let i = 0; i < pile.nx; i++) slots.push({ gx: pile.gx + i * 0.7, gy: pile.gy + j * 0.7, layer });
      }
    }
  }
  return slots;
}
