"use client";

import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { daysSince } from "@/domains/finance/money";
import { easeInOut, pathLength, pointAlong, projector, type GridPt, type Proj } from "./iso";
import type { TownLayout } from "./layouts";
import { Alert, Bubble, CoinGlyph, KeepGlyph, NameTag, RegionBanner, RegionSign, Scaled, WaitBar } from "./overlays";
import { GROUND, INK, TOWN } from "./palette";
import { crateSlots, GroundLayer, staticItems, TownDefs, type DepthItem } from "./scenery";
import { Cart, Crate, Kiwi } from "./sprites";
import { CONFIRM_LIMIT_DAYS, COURIER_SCARF, type TownCart, type TownView } from "./townView";
import { MOTION_MS, type Float, type Motion } from "./useTownMotion";

const num = (n: number) => Math.round(n).toLocaleString("en-US");

interface CartView {
  cart: TownCart;
  at: GridPt;
  courier: GridPt;
  dir: GridPt;
  mode: "moving" | "waiting" | "entering" | "returning";
  opacity: number;
}

const progress = (motion: Motion | undefined, now: number) =>
  motion ? Math.min(1, Math.max(0, (now - motion.start) / MOTION_MS[motion.kind])) : 1;

/** 每台推車現在在哪：等確認的排在主堡門口，剛送出、剛確認、被退回的照動畫沿著路走。 */
function cartViews(view: TownView, layout: TownLayout, motions: Record<number, Motion>, now: number): CartView[] {
  const routeOf = (cart: TownCart) => layout.slots[Math.min(cart.route, layout.slots.length - 1)].route;
  const along = (path: readonly GridPt[], d: number) => {
    const here = pointAlong(path, d);
    return { at: here.at, dir: here.dir, courier: pointAlong(path, d + 0.55).at };
  };
  const views: CartView[] = view.carts.map((cart) => {
    const route = routeOf(cart);
    const stop = Math.max(0, pathLength(route) - cart.queue * 1.3);
    const motion = motions[cart.id];
    const t = motion?.kind === "arrive" ? progress(motion, now) : 1;
    return { cart, ...along(route, easeInOut(t) * stop), mode: t < 1 ? "moving" : "waiting", opacity: 1 };
  });
  for (const motion of Object.values(motions)) {
    if (motion.kind === "arrive") continue;
    const t = progress(motion, now);
    if (t >= 1) continue;
    const path = motion.kind === "enter" ? layout.entry : [...routeOf(motion.cart)].reverse();
    views.push({
      cart: motion.cart,
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

/**
 * 奇異鳥小鎮的地圖（docs/finance-game-style.md）。建築、樹、河是固定的；
 * 人、推車、箱子、泡泡全部從 `view`（真資料）來。
 */
export default function TownScene({
  layout,
  view,
  motions,
  now,
  floats,
  bubbleScale,
  onKeep,
  onPerson,
  className,
}: {
  layout: TownLayout;
  view: TownView;
  motions: Record<number, Motion>;
  now: number;
  floats: Float[];
  /** 泡泡反向放大倍率（地圖縮小時字維持可讀）。 */
  bubbleScale: number;
  onKeep: () => void;
  onPerson: (userId: number) => void;
  className?: string;
}) {
  const P: Proj = useMemo(() => projector(layout.origin[0], layout.origin[1]), [layout]);
  const statics = useMemo(() => staticItems(P, layout), [P, layout]);
  const slots = useMemo(() => crateSlots(layout), [layout]);
  const wide = layout.kind === "wide";
  const k = bubbleScale;
  const carts = cartViews(view, layout, motions, now);
  const onMap = view.people.filter((p) => p.slot !== null && p.slot < layout.slots.length);
  const ownerName = view.owner?.name ?? "老闆";

  // ---------- 依深度排序的立體物件 ----------
  const crates: DepthItem[] = slots.slice(0, view.crates.count).map((s, i) => ({
    key: `crate${i}`,
    depth: s.gx + s.gy + 0.62 + s.layer * 0.01,
    node: (
      <g className="town-drop" style={{ animationDelay: `${(i % 8) * 30}ms` }}>
        <Crate P={P} gx={s.gx} gy={s.gy} layer={s.layer} />
      </g>
    ),
  }));
  const people: DepthItem[] = onMap.map((p) => {
    const spot = layout.slots[p.slot!];
    const [x, y] = P(spot.at[0], spot.at[1]);
    return {
      key: `kiwi-${p.id}`,
      depth: spot.at[0] + spot.at[1] + 0.5,
      node: (
        <g>
          <Kiwi x={x} y={y} s={1.1} scarf={p.scarf} flip={spot.flip} accessory={p.inHand > 0 ? (p.overdue ? "sack" : "pack") : undefined} />
          {p.overdue && (
            <g className="town-puff">
              <circle cx={x - (spot.flip ? -20 : 20)} cy={y - 46} r={5} fill="#C9C5BE" />
              <circle cx={x - (spot.flip ? -27 : 27)} cy={y - 53} r={3.5} fill="#C9C5BE" />
            </g>
          )}
        </g>
      ),
    };
  });
  if (view.owner) {
    const [x, y] = P(layout.owner.at[0], layout.owner.at[1]);
    people.push({
      key: "kiwi-owner",
      depth: layout.owner.at[0] + layout.owner.at[1] + 0.5,
      node: <Kiwi x={x} y={y} s={1.1} scarf={view.owner.scarf} flip={layout.owner.flip} accessory="crown" />,
    });
  }
  const cartItems: DepthItem[] = carts.flatMap((c) => {
    const [cx, cy] = P(c.courier[0], c.courier[1]);
    const alongGx = Math.abs(c.dir[0]) > Math.abs(c.dir[1]);
    return [
      {
        key: `cart-${c.cart.id}`,
        depth: c.at[0] + c.at[1] + 0.3,
        node: (
          <g opacity={c.opacity}>
            <Cart P={P} gx={c.at[0]} gy={c.at[1]} flag={c.cart.scarf} alongGx={alongGx} />
          </g>
        ),
      },
      {
        key: `courier-${c.cart.id}`,
        depth: c.courier[0] + c.courier[1] + 0.3,
        node: (
          <g opacity={c.opacity}>
            <Kiwi x={cx} y={cy} s={0.95} scarf={COURIER_SCARF} accessory="cap" flip={c.dir[0] - c.dir[1] < 0} />
          </g>
        ),
      },
    ];
  });
  const sorted = [...statics, ...crates, ...people, ...cartItems].sort((a, b) => a.depth - b.depth);

  // ---------- 泡泡、名牌、點擊區 ----------
  const overlays: ReactNode[] = [];
  const hits: ReactNode[] = [];

  // 地區看板：教室的分部（沒設分部就不畫）
  view.regions.forEach(({ title, sub }, i) => {
    const r = layout.regions[i];
    if (!r) return;
    if (wide) {
      overlays.push(<RegionBanner key={`region${i}`} x={r.banner[0]} y={r.banner[1]} title={title} sub={sub} dot={i === 0 ? TOWN.coral : TOWN.keepRoof[2]} />);
    } else {
      const [x, y] = P(r.sign[0], r.sign[1]);
      overlays.push(
        <Scaled key={`sign${i}`} ax={x} ay={y} k={k}>
          <RegionSign x={x} y={y} title={title} />
        </Scaled>
      );
    }
  });

  // 跳舞的音符
  const [nx, ny] = P(layout.floor.gx + layout.floor.w / 2, layout.floor.gy + layout.floor.d / 2, 56);
  overlays.push(
    <g key="notes" className="town-bob" aria-hidden="true">
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
            <text x={44} y={35} fontSize={18} fontWeight={600} fill={view.figures.vault < 0 ? TOWN.lateText : INK}>
              {view.figures.vault < 0 ? "−" : ""}${num(Math.abs(view.figures.vault))}
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
    hits.push(
      <Hit
        key="hit-keep"
        x={Math.min(lx, kx - (plateW / 2) * k)}
        y={top}
        w={Math.max(rx - lx, plateW * k)}
        h={front - top}
        label={`主堡：財庫 $${num(view.figures.vault)}，點開看詳細`}
        onActivate={onKeep}
      />
    );
  }

  // 營收負責人
  if (view.owner) {
    const [x, y] = P(layout.owner.at[0], layout.owner.at[1]);
    if (wide) overlays.push(<Scaled key="tag-owner" ax={x} ay={y} k={k}><NameTag x={x} y={y + 8} label={view.owner.name} /></Scaled>);
    if (view.carts.length > 0) {
      const text = view.viewer.isOwner ? (wide ? "等你確認" : `${view.owner.name} · 等你確認`) : `等${view.owner.name}確認`;
      const w = 50 + text.length * 13;
      overlays.push(
        <Scaled key="bell" ax={x} ay={y} k={k}>
          <Bubble cx={x + (wide ? 4 : 6)} bottom={y - 50} w={w} h={34}>
            <path d="M22 11 a6 6 0 0 1 6 6 v4 l2 3 h-16 l2 -3 v-4 a6 6 0 0 1 6 -6z" fill={TOWN.coin} />
            <circle cx={22} cy={26.5} r={2} fill={TOWN.coinRim} />
            <circle cx={29} cy={11} r={5.5} fill={TOWN.late} />
            <text x={29} y={14} fontSize={8.5} fontWeight={700} textAnchor="middle" fill="#FFFFFF">
              {view.carts.length}
            </text>
            <text x={38} y={23} fontSize={13} fontWeight={700} fill={INK}>
              {text}
            </text>
          </Bubble>
        </Scaled>
      );
    }
    hits.push(<Hit key="hit-owner" x={x - 28 * k} y={y - 60 * k} w={56 * k} h={70 * k} label={`${view.owner.name}：營收負責人，自己收的錢直接進主堡`} onActivate={onKeep} />);
  }

  // 地圖上的代收人
  for (const p of onMap) {
    const spot = layout.slots[p.slot!];
    const [x, y] = P(spot.at[0], spot.at[1]);
    const tag = p.overdue ? `${p.daysHeld} 天沒繳` : null;
    const w = tag ? 180 : 112;
    const tallRight = layout.kind === "tall" && spot.flip;
    overlays.push(
      <Scaled key={`tag-${p.id}`} ax={x} ay={y} k={k}>
        <NameTag x={x} y={y + 8} label={p.name} />
        {p.inHand > 0 && (
          <Bubble cx={x + (tallRight ? -40 : spot.flip ? 0 : 2)} bottom={y - (tallRight ? 40 : 46)} w={w} h={34}>
            {p.overdue ? <path d="M18 9 q7 9 7 13 a7 7 0 0 1 -14 0 q0 -4 7 -13z" fill="#9CCBEB" /> : <CoinGlyph x={20} y={17} />}
            <text x={34} y={23.5} fontSize={18} fontWeight={600} fill={INK}>
              ${num(p.inHand)}
            </text>
            {tag && (
              <>
                <rect x={98} y={8} width={72} height={20} rx={10} fill={TOWN.lateBg} />
                <text x={134} y={22} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={TOWN.lateText}>
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
        key={`hit-${p.id}`}
        x={x - 30 * k}
        y={y - 92 * k}
        w={60 * k}
        h={120 * k}
        label={`${p.name}的背包：手上 $${num(p.inHand)}${tag ? `，${tag}` : ""}`}
        onActivate={() => onPerson(p.id)}
      />
    );
  }

  // 推車（同時最多 3 個泡泡，其他的只畫車，§5 規則 5）
  carts.forEach((c, i) => {
    const [ax, ay] = P(c.at[0], c.at[1], 44);
    if (c.mode === "moving" || c.mode === "waiting") {
      if (i < 3) {
        const waited = daysSince(new Date(c.cart.createdAt));
        const long = c.cart.fromName.length > 2;
        overlays.push(
          <Scaled key={`bubble-${c.cart.id}`} ax={ax} ay={ay} k={k}>
            <Bubble cx={ax} bottom={ay - i * 6} w={long ? 168 : 152} h={54}>
              <circle cx={20} cy={18} r={11} fill="#E3F7F0" />
              <Kiwi x={17} y={27} s={0.5} scarf={c.cart.scarf} />
              <text x={38} y={23} fontSize={13} fontWeight={700} fill={INK}>
                {c.cart.fromName.slice(0, 4)}
              </text>
              <text x={long ? 86 : 70} y={24} fontSize={18} fontWeight={600} fill={INK}>
                ${num(c.cart.amount)}
              </text>
              <WaitBar x={14} y={36} ratio={c.mode === "moving" ? 0 : waited / CONFIRM_LIMIT_DAYS} label={c.mode === "moving" ? "上路中" : waited === 0 ? "剛到" : `${waited} 天`} />
            </Bubble>
            {c.mode === "waiting" && <Alert x={ax + (long ? 78 : 70)} y={ay - 62 - i * 6} />}
          </Scaled>
        );
      }
      if (wide && i === 0) {
        const [tx, ty] = P(c.courier[0], c.courier[1]);
        overlays.push(<Scaled key={`courier-tag-${c.cart.id}`} ax={tx} ay={ty} k={k}><NameTag x={tx + 4} y={ty + 8} label="轉交中" tone="wait" /></Scaled>);
      }
      hits.push(
        <Hit key={`hit-cart-${c.cart.id}`} x={ax - 76 * k} y={ay - 64 * k} w={152 * k} h={110 * k} label={`${c.cart.fromName}送來 $${num(c.cart.amount)}，等${ownerName}確認`} onActivate={onKeep} />
      );
    } else if (c.mode === "returning") {
      const [tx, ty] = P(c.courier[0], c.courier[1]);
      overlays.push(
        <g key={`return-${c.cart.id}`} opacity={c.opacity}>
          <Scaled ax={tx} ay={ty} k={k}>
            <NameTag x={tx} y={ty - 62} label="開回家" tone="wait" />
          </Scaled>
        </g>
      );
    }
  });

  // 浮起來的 +$
  for (const f of floats) {
    let x = kx;
    let y = kTop - 50 * k;
    if (f.target !== "vault") {
      const p = onMap.find((m) => m.id === f.target);
      if (!p) continue;
      const spot = layout.slots[p.slot!];
      [x, y] = P(spot.at[0], spot.at[1]);
      y -= 92 * k;
    }
    overlays.push(
      <Scaled key={`float-${f.id}`} ax={x} ay={y} k={k}>
        <text className="town-rise" x={x} y={y} fontSize={20} fontWeight={700} textAnchor="middle" fill={f.amount >= 0 ? TOWN.growText : TOWN.lateText} stroke="#FFFDF7" strokeWidth={4} paintOrder="stroke">
          {f.amount >= 0 ? "+" : "−"}${num(Math.abs(f.amount))}
        </text>
      </Scaled>
    );
  }

  const [vx, vy, vw, vh] = layout.viewBox;
  const summary = view.people
    .filter((p) => p.inHand > 0)
    .map((p) => `${p.name}手上 $${num(p.inHand)}`)
    .join("、");
  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      className={className}
      role="group"
      aria-label={`奇異鳥小鎮：主堡財庫 $${num(view.figures.vault)}${summary ? `，${summary}` : ""}，${view.carts.length} 台推車等確認`}
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
