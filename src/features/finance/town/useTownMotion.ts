"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { TownCart } from "./townView";

/**
 * 推車的動畫跟著資料走：兩次總覽之間多出來的推車「開到門口」；不見的推車，
 * 如果是這個畫面剛按了「收到了」就「開進倉庫」（主堡頭上浮 +$），否則「開回家」（退回或撤回）。
 * 第一次載入不動，減少動態時全部不動。
 */
export type MotionKind = "arrive" | "enter" | "return";
export interface Motion {
  kind: MotionKind;
  start: number;
  /** 不見的推車沒有資料了，動畫期間用這份。 */
  cart: TownCart;
}
export const MOTION_MS: Record<MotionKind, number> = { arrive: 2600, enter: 1400, return: 2400 };

export interface Float {
  id: string;
  /** 誰頭上：主堡，或某個代收人。 */
  target: "vault" | number;
  amount: number;
}

function useFrameClock(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return now;
}

export function useTownMotion(carts: TownCart[] | undefined) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const previous = useRef<Map<number, TownCart> | null>(null);
  const confirmed = useRef(new Set<number>());
  const [motions, setMotions] = useState<Record<number, Motion>>({});
  const [floats, setFloats] = useState<Float[]>([]);
  const now = useFrameClock(Object.keys(motions).length > 0);

  useEffect(() => {
    if (!carts) return;
    const current = new Map(carts.map((c) => [c.id, c]));
    const before = previous.current;
    previous.current = current;
    if (!before || reduced) return;
    const start = performance.now();
    const added: Record<number, Motion> = {};
    const risen: Float[] = [];
    for (const [id, cart] of current) if (!before.has(id)) added[id] = { kind: "arrive", start, cart };
    for (const [id, cart] of before) {
      if (current.has(id)) continue;
      const entered = confirmed.current.delete(id);
      added[id] = { kind: entered ? "enter" : "return", start, cart };
      if (entered) risen.push({ id: `in-${id}`, target: "vault", amount: cart.amount });
    }
    if (Object.keys(added).length > 0) setMotions((m) => ({ ...m, ...added }));
    if (risen.length > 0) {
      setFloats((f) => [...f, ...risen]);
      setTimeout(() => setFloats((f) => f.filter((x) => !risen.includes(x))), 1900);
    }
  }, [carts, reduced]);

  // 走完的移掉
  useEffect(() => {
    const done = Object.entries(motions).filter(([, m]) => now - m.start > MOTION_MS[m.kind]);
    if (done.length === 0) return;
    setMotions((current) => {
      const next = { ...current };
      for (const [id] of done) delete next[Number(id)];
      return next;
    });
  }, [now, motions]);

  /** 這個畫面按了「收到了」：下一次資料更新時那台推車開進倉庫。 */
  const markConfirmed = (id: number) => confirmed.current.add(id);

  return { motions, now, floats, markConfirmed };
}
