"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { moneyText } from "../Money";
import { easeInOut, pathLength, pointAlong, projector, type GridPt, type Proj } from "./iso";
import type { TownLayout } from "./layouts";
import { Alert, Bubble, CoinGlyph, KeepGlyph, NameTag, RegionBanner, RegionSign, Scaled, WaitBar } from "./overlays";
import { GROUND, INK, TOWN } from "./palette";
import { crateSlots, GroundLayer, staticItems, TownDefs, type DepthItem } from "./scenery";
import { Cart, Crate, Kiwi } from "./sprites";
import {
  companyMoney,
  crateCount,
  CUSTODIANS,
  daysBetween,
  heldDays,
  holdingOf,
  isOverdue,
  lastRejection,
  MEMBERS,
  memberOf,
  pendingRemittances,
  SETTINGS,
  TODAY,
  type MemberId,
  type Place,
  type TownState,
} from "./townModel";
import { MOTION_MS, type Float, type Motion } from "./useTown";

interface CartView {
  id: string;
  fromId: MemberId;
  amount: number;
  date: string;
  at: GridPt;
  courier: GridPt;
  dir: GridPt;
  mode: "moving" | "waiting" | "entering" | "returning";
  /** 0～1，快走完時淡出。 */
  opacity: number;
}

const progress = (motion: Motion | undefined, now: number) => (motion ? Math.min(1, Math.max(0, (now - motion.start) / MOTION_MS[motion.kind])) : 1);

/** 每台推車現在在哪：等確認的排在主堡門口，送出、確認、退回的照動畫沿著路走。 */
function cartViews(state: TownState, layout: TownLayout, motions: Record<string, Motion>, now: number): CartView[] {
  const views: CartView[] = [];
  const along = (path: readonly GridPt[], d: number) => {
    const here = pointAlong(path, d);
    return { at: here.at, dir: here.dir, courier: pointAlong(path, d + 0.55).at };
  };
  pendingRemittances(state).forEach((r, queue) => {
    if (memberOf(r.fromId).isOwner) return;
    const route = layout.routes[r.fromId as keyof TownLayout["routes"]];
    const stop = Math.max(0, pathLength(route) - queue * 1.3);
    const motion = motions[r.id];
    const t = motion?.kind === "arrive" ? progress(motion, now) : 1;
    views.push({ id: r.id, fromId: r.fromId, amount: r.amount, date: r.date, ...along(route, easeInOut(t) * stop), mode: t < 1 ? "moving" : "waiting", opacity: 1 });
  });
  for (const r of state.remittances) {
    const motion = motions[r.id];
    if (!motion || motion.kind === "arrive" || memberOf(r.fromId).isOwner) continue;
    const t = progress(motion, now);
    if (t >= 1) continue;
    const path = motion.kind === "enter" ? layout.entry : [...layout.routes[r.fromId as keyof TownLayout["routes"]]].reverse();
    views.push({
      id: r.id,
      fromId: r.fromId,
      amount: r.amount,
      date: r.date,
      ...along(path, easeInOut(t) * pathLength(path)),
      mode: motion.kind === "enter" ? "entering" : "returning",
      opacity: t > 0.8 ? (1 - t) / 0.2 : 1,
    });
  }
  return views;
}

/** 可以點的區域：透明、可以用 Tab 走到、Enter／空白鍵也能開。 */
function Hit({ x, y, w, h, label, onActivate }: { x: number; y: number; w: number; h: number; label: string; onActivate: () => void }) {
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
  return (
    <g role="button" tabIndex={0} aria-label={label} className="town-hit" onClick={onActivate} onKeyDown={onKeyDown}>
      <rect className="town-hit-ring" x={x} y={y} width={w} height={h} rx={14} fill="transparent" stroke="transparent" />
    </g>
  );
}

function screenDx(dir: GridPt) {
  return dir[0] - dir[1];
}

export default function TownScene({
  layout,
  state,
  viewer,
  motions,
  now,
  floats,
  bubbleScale,
  onKeep,
  onPerson,
  onPlace,
  className,
}: {
  layout: TownLayout;
  state: TownState;
  viewer: MemberId;
  motions: Record<string, Motion>;
  now: number;
  floats: Float[];
  /** 泡泡反向放大倍率（地圖縮小時字維持可讀）。 */
  bubbleScale: number;
  onKeep: () => void;
  onPerson: (id: MemberId) => void;
  onPlace: (place: Place) => void;
  className?: string;
}) {
  const P: Proj = useMemo(() => projector(layout.origin[0], layout.origin[1]), [layout]);
  const statics = useMemo(() => staticItems(P, layout), [P, layout]);
  const slots = useMemo(() => crateSlots(layout), [layout]);
  const wide = layout.kind === "wide";
  const k = bubbleScale;
  const money = companyMoney(state);
  const carts = cartViews(state, layout, motions, now);
  const pending = pendingRemittances(state);
  const viewerIsOwner = memberOf(viewer).isOwner;

  // ---------- 依深度排序的立體物件 ----------
  const crates: DepthItem[] = slots.slice(0, crateCount(money.vault)).map((s, i) => ({
    key: `crate${i}`,
    depth: s.gx + s.gy + 0.62 + s.layer * 0.01,
    node: (
      <g className="town-drop" style={{ animationDelay: `${(i % 8) * 30}ms` }}>
        <Crate P={P} gx={s.gx} gy={s.gy} layer={s.layer} />
      </g>
    ),
  }));
  const people: DepthItem[] = MEMBERS.map((m) => {
    const spot = layout.spots[m.id];
    const [x, y] = P(spot.at[0], spot.at[1]);
    const holding = holdingOf(state, m.id);
    const late = isOverdue(state, m.id);
    return {
      key: `kiwi-${m.id}`,
      depth: spot.at[0] + spot.at[1] + 0.5,
      node: (
        <g>
          <Kiwi x={x} y={y} s={1.1} scarf={m.scarf} flip={spot.flip} accessory={m.isOwner ? "crown" : holding > 0 ? (late ? "sack" : "pack") : undefined} />
          {late && (
            <g className="town-puff">
              <circle cx={x - (spot.flip ? -20 : 20)} cy={y - 46} r={5} fill="#C9C5BE" />
              <circle cx={x - (spot.flip ? -27 : 27)} cy={y - 53} r={3.5} fill="#C9C5BE" />
            </g>
          )}
        </g>
      ),
    };
  });
  const cartItems: DepthItem[] = carts.flatMap((c) => {
    const member = memberOf(c.fromId);
    const [cx, cy] = P(c.courier[0], c.courier[1]);
    const alongGx = Math.abs(c.dir[0]) > Math.abs(c.dir[1]);
    return [
      {
        key: `cart-${c.id}`,
        depth: c.at[0] + c.at[1] + 0.3,
        node: (
          <g opacity={c.opacity}>
            <Cart P={P} gx={c.at[0]} gy={c.at[1]} flag={member.scarf} alongGx={alongGx} />
          </g>
        ),
      },
      {
        key: `courier-${c.id}`,
        depth: c.courier[0] + c.courier[1] + 0.3,
        node: (
          <g opacity={c.opacity}>
            <Kiwi x={cx} y={cy} s={0.95} scarf="#6FA8DC" accessory="cap" flip={screenDx(c.dir) < 0} />
          </g>
        ),
      },
    ];
  });
  const sorted = [...statics, ...crates, ...people, ...cartItems].sort((a, b) => a.depth - b.depth);

  // ---------- 泡泡、名牌、點擊區 ----------
  const overlays: ReactNode[] = [];
  const hits: ReactNode[] = [];

  // 建築（先放，人和主堡的點擊區疊在上面）：台南丁丁家＋舞蹈地板、高雄教室、地區看板
  {
    const { house, floor, classroom } = layout;
    const [hl] = P(house.gx, house.gy + 3);
    const [hr] = P(house.gx + 3, house.gy);
    const [, hTop] = P(house.gx + 1.5, house.gy, 42 + 36 + 6);
    const [, hBottom] = P(house.gx + 3, house.gy + 3);
    hits.push(<Hit key="hit-house" x={hl} y={hTop} w={hr - hl} h={hBottom - hTop} label="台南 · 丁丁家：場地規則、場地費紀錄" onActivate={() => onPlace("tainan")} />);
    const [fl] = P(floor.gx, floor.gy + floor.d);
    const [fr] = P(floor.gx + floor.w, floor.gy);
    const [, fTop] = P(floor.gx, floor.gy, 40);
    const [, fBottom] = P(floor.gx + floor.w, floor.gy + floor.d);
    hits.push(<Hit key="hit-floor" x={fl} y={fTop} w={fr - fl} h={fBottom - fTop} label="台南的舞蹈地板：場地規則、場地費紀錄" onActivate={() => onPlace("tainan")} />);
    const [cl] = P(classroom.gx, classroom.gy + classroom.d);
    const [cr] = P(classroom.gx + classroom.w, classroom.gy);
    const [, cTop] = P(classroom.gx, classroom.gy, classroom.h + 16);
    const [, cBottom] = P(classroom.gx + classroom.w, classroom.gy + classroom.d);
    hits.push(<Hit key="hit-classroom" x={cl} y={cTop} w={cr - cl} h={cBottom - cTop} label="高雄 · 租的教室：場地規則、場租紀錄" onActivate={() => onPlace("kaohsiung")} />);
    const places: Place[] = ["tainan", "kaohsiung"];
    layout.regions.forEach((r, i) => {
      if (wide) {
        const w = Math.max(30 + r.title.length * 15 + 14, 18 + r.sub.length * 11.5) + 18;
        hits.push(<Hit key={`hit-region${i}`} x={r.banner[0]} y={r.banner[1]} w={w} h={48} label={`${r.title}：場地規則、場地費紀錄`} onActivate={() => onPlace(places[i])} />);
      } else {
        const [x, y] = P(r.sign[0], r.sign[1]);
        hits.push(<Hit key={`hit-region${i}`} x={x - 36 * k} y={y - 34 * k} w={72 * k} h={44 * k} label={`${r.title}：場地規則、場地費紀錄`} onActivate={() => onPlace(places[i])} />);
      }
    });
  }

  if (wide) {
    layout.regions.forEach((r, i) => overlays.push(<RegionBanner key={`region${i}`} x={r.banner[0]} y={r.banner[1]} title={r.title} sub={r.sub} dot={i === 0 ? TOWN.coral : TOWN.keepRoof[2]} />));
  } else {
    layout.regions.forEach((r, i) => {
      const [x, y] = P(r.sign[0], r.sign[1]);
      overlays.push(
        <Scaled key={`sign${i}`} ax={x} ay={y} k={k}>
          <RegionSign x={x} y={y} title={r.title} />
        </Scaled>
      );
    });
  }

  // 跳舞的音符
  const [nx, ny] = P(layout.floor.gx + layout.floor.w / 2, layout.floor.gy + layout.floor.d / 2, 56);
  overlays.push(
    <g key="notes" className="town-bob">
      <text x={nx} y={ny} fontSize={18} fill="#E58BAE">
        ♪
      </text>
      <text x={nx + 16} y={ny - 10} fontSize={14} fill="#E58BAE">
        ♫
      </text>
    </g>
  );

  // 主堡名牌
  const keep = layout.keep;
  const [kx, kTop] = P(keep.gx + keep.size / 2, keep.gy + keep.size / 2, keep.height + 10 + keep.roof + 30);
  const plateW = wide ? 172 : 114;
  overlays.push(
    <Scaled key="plate" ax={kx} ay={kTop} k={k}>
      <Bubble cx={kx} bottom={kTop} w={plateW} h={wide ? 42 : 38}>
        <KeepGlyph x={wide ? 22 : 20} y={wide ? 21 : 19} />
        {wide ? (
          <>
            <text x={44} y={18} fontSize={11} fontWeight={700} fill="#8C7B6B">
              主堡財庫
            </text>
            <text x={44} y={35} fontSize={18} fontWeight={600} fill={INK}>
              ${moneyText(money.vault)}
            </text>
          </>
        ) : (
          <text x={40} y={24.5} fontSize={15} fontWeight={700} fill={INK}>
            主堡
          </text>
        )}
        <text x={plateW - 12} y={wide ? 27 : 24.5} fontSize={12} fontWeight={700} textAnchor="end" fill="#2B8E6E">
          點開 ›
        </text>
      </Bubble>
    </Scaled>
  );
  {
    const [lx] = P(keep.gx, keep.gy + keep.size);
    const [rx] = P(keep.gx + keep.size, keep.gy);
    const [, front] = P(keep.gx + keep.size, keep.gy + keep.size);
    const top = kTop - (wide ? 50 : 46) * k;
    hits.push(<Hit key="hit-keep" x={Math.min(lx, kx - (plateW / 2) * k)} y={top} w={Math.max(rx - lx, plateW * k)} h={front - top} label={`主堡：財庫 $${moneyText(money.vault)}，點開看詳細`} onActivate={onKeep} />);
  }

  // 每個人
  for (const m of MEMBERS) {
    const spot = layout.spots[m.id];
    const [x, y] = P(spot.at[0], spot.at[1]);
    if (m.isOwner) {
      if (wide) overlays.push(<Scaled key="tag-boss" ax={x} ay={y} k={k}><NameTag x={x} y={y + 8} label={m.name} /></Scaled>);
      if (pending.length > 0) {
        const text = viewerIsOwner ? (wide ? "等你確認" : "老闆 · 等你確認") : "等老闆確認";
        const w = text.length > 5 ? 132 : 112;
        overlays.push(
          <Scaled key="bell" ax={x} ay={y} k={k}>
            <Bubble cx={x + (wide ? 4 : 6)} bottom={y - 50} w={w} h={34}>
              <path d="M22 11 a6 6 0 0 1 6 6 v4 l2 3 h-16 l2 -3 v-4 a6 6 0 0 1 6 -6z" fill={TOWN.coin} />
              <circle cx={22} cy={26.5} r={2} fill={TOWN.coinRim} />
              <circle cx={29} cy={11} r={5.5} fill={TOWN.late} />
              <text x={29} y={14} fontSize={8.5} fontWeight={700} textAnchor="middle" fill="#FFFFFF">
                {pending.length}
              </text>
              <text x={38} y={23} fontSize={13} fontWeight={700} fill={INK}>
                {text}
              </text>
            </Bubble>
          </Scaled>
        );
      }
      hits.push(<Hit key="hit-boss" x={x - 28 * k} y={y - 60 * k} w={56 * k} h={70 * k} label={`${m.name}：自己收的錢直接進主堡`} onActivate={() => onPerson(m.id)} />);
      continue;
    }
    const holding = holdingOf(state, m.id);
    const days = heldDays(state, m.id);
    const late = isOverdue(state, m.id);
    const rejected = lastRejection(state, m.id);
    const tag = late ? `${days} 天沒繳` : rejected ? "被退回" : null;
    const w = tag ? 180 : 112;
    const shift = layout.kind === "tall" && m.id === "teacherB" ? -40 : spot.flip ? 0 : 2;
    overlays.push(
      <Scaled key={`tag-${m.id}`} ax={x} ay={y} k={k}>
        <NameTag x={x} y={y + 8} label={m.name} />
        {(holding > 0 || rejected) && (
          <Bubble cx={x + shift} bottom={y - (layout.kind === "tall" && m.id === "teacherB" ? 40 : 46)} w={w} h={34}>
            {late ? (
              <path d="M18 9 q7 9 7 13 a7 7 0 0 1 -14 0 q0 -4 7 -13z" fill="#9CCBEB" />
            ) : (
              <CoinGlyph x={20} y={17} />
            )}
            <text x={34} y={23.5} fontSize={18} fontWeight={600} fill={INK}>
              ${moneyText(holding)}
            </text>
            {tag && (
              <>
                <rect x={98} y={8} width={72} height={20} rx={10} fill={late ? TOWN.lateBg : TOWN.waitBg} />
                <text x={134} y={22} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={late ? TOWN.lateText : TOWN.waitText}>
                  {tag}
                </text>
              </>
            )}
          </Bubble>
        )}
      </Scaled>
    );
    hits.push(
      <Hit
        key={`hit-${m.id}`}
        x={x - 30 * k}
        y={y - 92 * k}
        w={60 * k}
        h={120 * k}
        label={`${m.name}的背包：手上 $${moneyText(holding)}${tag ? `，${tag}` : ""}`}
        onActivate={() => onPerson(m.id)}
      />
    );
  }

  // 推車
  for (const c of carts) {
    const member = memberOf(c.fromId);
    const [ax, ay] = P(c.at[0], c.at[1], 44);
    if (c.mode === "moving" || c.mode === "waiting") {
      const waited = daysBetween(c.date, TODAY);
      overlays.push(
        <Scaled key={`bubble-${c.id}`} ax={ax} ay={ay} k={k}>
          <Bubble cx={ax} bottom={ay} w={member.name.length > 2 ? 168 : 152} h={54}>
            <circle cx={20} cy={18} r={11} fill="#E3F7F0" />
            <Kiwi x={17} y={27} s={0.5} scarf={member.scarf} />
            <text x={38} y={23} fontSize={13} fontWeight={700} fill={INK}>
              {member.name}
            </text>
            <text x={member.name.length > 2 ? 86 : 70} y={24} fontSize={18} fontWeight={600} fill={INK}>
              ${moneyText(c.amount)}
            </text>
            <WaitBar x={14} y={36} ratio={c.mode === "moving" ? 0 : waited / SETTINGS.confirmLimitDays} label={c.mode === "moving" ? "上路中" : waited === 0 ? "剛到" : `${waited} 天`} />
          </Bubble>
          {c.mode === "waiting" && <Alert x={ax + (member.name.length > 2 ? 78 : 70)} y={ay - 62} />}
        </Scaled>
      );
      if (wide) {
        const [tx, ty] = P(c.courier[0], c.courier[1]);
        overlays.push(<Scaled key={`courier-tag-${c.id}`} ax={tx} ay={ty} k={k}><NameTag x={tx + 4} y={ty + 8} label="轉交中" tone="wait" /></Scaled>);
      }
      hits.push(<Hit key={`hit-${c.id}`} x={ax - 76 * k} y={ay - 64 * k} w={152 * k} h={110 * k} label={`${member.name}送來 $${moneyText(c.amount)}，等老闆確認`} onActivate={onKeep} />);
    } else if (c.mode === "returning") {
      const [tx, ty] = P(c.courier[0], c.courier[1]);
      overlays.push(
        <g key={`return-${c.id}`} opacity={c.opacity}>
          <Scaled ax={tx} ay={ty} k={k}>
            <NameTag x={tx} y={ty - 62} label="開回家" tone="wait" />
          </Scaled>
        </g>
      );
    }
  }

  // 浮起來的 +$
  for (const f of floats) {
    let x: number;
    let y: number;
    if (f.target === "vault") {
      x = kx;
      y = kTop - 50 * k;
    } else {
      const spot = layout.spots[f.target];
      [x, y] = P(spot.at[0], spot.at[1]);
      y -= 92 * k;
    }
    overlays.push(
      <Scaled key={`float-${f.id}`} ax={x} ay={y} k={k}>
        <text className="town-rise" x={x} y={y} fontSize={20} fontWeight={700} textAnchor="middle" fill={f.amount >= 0 ? TOWN.growText : TOWN.lateText} stroke="#FFFDF7" strokeWidth={4} paintOrder="stroke">
          {f.amount >= 0 ? "+" : "−"}${moneyText(Math.abs(f.amount))}
        </text>
      </Scaled>
    );
  }

  const [vx, vy, vw, vh] = layout.viewBox;
  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      className={className}
      role="group"
      aria-label={`奇異鳥小鎮：主堡財庫 $${moneyText(money.vault)}，${CUSTODIANS.map((m) => `${m.name}手上 $${moneyText(holdingOf(state, m.id))}`).join("、")}，${pending.length} 台推車等確認`}
    >
      <TownDefs />
      <rect x={vx} y={vy} width={vw} height={vh} fill={GROUND} />
      <GroundLayer layout={layout} />
      {sorted.map((item) => (
        <g key={item.key}>{item.node}</g>
      ))}
      {overlays}
      {hits}
    </svg>
  );
}
