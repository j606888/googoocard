"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { moneyText } from "../Money";
import {
  INITIAL_STATE,
  memberOf,
  nextId,
  townReducer,
  type EntryCategory,
  type MemberId,
  type PayMethod,
  type Place,
} from "./townModel";

/** 現在開著哪個抽屜。 */
export type TownDialog =
  | { kind: "keep" }
  | { kind: "person"; id: MemberId }
  | { kind: "remit" }
  | { kind: "expense" }
  | { kind: "collect" }
  | { kind: "legend" }
  | { kind: "place"; place: Place };

/** 推車的三種移動：送出後走到主堡門口、確認後走進倉庫、退回／撤回時走回家。 */
export type MotionKind = "arrive" | "enter" | "return";
export interface Motion {
  kind: MotionKind;
  start: number;
}
export const MOTION_MS: Record<MotionKind, number> = { arrive: 2600, enter: 1400, return: 2400 };

/** 頭上浮起來的 +$ 數字；`target` 是誰的背包，或主堡。 */
export interface Float {
  id: string;
  target: MemberId | "vault";
  amount: number;
}

/** 有東西在動的時候每一幀更新一次時間（requestAnimationFrame 的時間戳）。 */
function useFrameClock(active: boolean): number {
  const [now, setNow] = useState(0);
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

/**
 * 小鎮這個畫面的狀態機（docs/ui-responsive.md 規則 2：邏輯在 hook，電腦、手機兩個外殼共用）。
 * 示意版：資料只在記憶體，`viewer` 是「用誰的身分看」。
 */
export function useTown() {
  const [state, dispatch] = useReducer(townReducer, INITIAL_STATE);
  const [viewer, setViewer] = useState<MemberId>("dd");
  const [dialog, setDialog] = useState<TownDialog | null>(null);
  const [ledger, setLedger] = useState(false);
  const [motions, setMotions] = useState<Record<string, Motion>>({});
  const [floats, setFloats] = useState<Float[]>([]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const now = useFrameClock(Object.keys(motions).length > 0);

  // 動完的推車移掉
  useEffect(() => {
    const done = Object.entries(motions).filter(([, m]) => now - m.start > MOTION_MS[m.kind]);
    if (done.length === 0) return;
    setMotions((current) => {
      const next = { ...current };
      for (const [id] of done) delete next[id];
      return next;
    });
  }, [now, motions]);

  const animate = useCallback(
    (id: string, kind: MotionKind) => {
      if (reducedMotion) return;
      setMotions((m) => ({ ...m, [id]: { kind, start: performance.now() } }));
    },
    [reducedMotion]
  );

  const float = useCallback((target: Float["target"], amount: number) => {
    const id = `${target}-${performance.now()}`;
    setFloats((f) => [...f, { id, target, amount }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1900);
  }, []);

  const collect = (input: { receiverId: MemberId; student: string; item: string; amount: number; method: PayMethod }) => {
    dispatch({ type: "collect", ...input });
    const receiver = memberOf(input.receiverId);
    float(receiver.isOwner ? "vault" : receiver.id, input.amount);
    toast.success(`${input.student}付了 $${moneyText(input.amount)} 給${receiver.name}`);
    setDialog(null);
  };

  const remit = (input: { amount: number; method: PayMethod; ref?: string; note?: string; date: string }) => {
    const id = nextId(state, "r");
    dispatch({ type: "remit", fromId: viewer, ...input });
    animate(id, "arrive");
    toast.success(`推車出發了！$${moneyText(input.amount)} 送往主堡，等老闆確認`);
    setDialog(null);
  };

  const withdraw = (id: string) => {
    dispatch({ type: "withdraw", id });
    animate(id, "return");
    toast("已撤回，推車開回家了");
  };

  const confirm = (id: string, amount: number) => {
    dispatch({ type: "confirm", id });
    animate(id, "enter");
    float("vault", amount);
    toast.success(`收到了！$${moneyText(amount)} 已入庫`);
  };

  const reject = (id: string, reason: string) => {
    dispatch({ type: "reject", id, reason });
    animate(id, "return");
    toast("已退回，推車掉頭了");
  };

  const record = (input: { category: EntryCategory; amount: number; payee?: string; note: string; place?: Place }) => {
    dispatch({ type: "record", ...input });
    float("vault", input.category === "loan" ? input.amount : -input.amount);
    toast.success(input.category === "loan" ? `老闆補了 $${moneyText(input.amount)} 進主堡` : `記好了：主堡付出 $${moneyText(input.amount)}`);
    setDialog(null);
  };

  const reset = () => {
    dispatch({ type: "reset" });
    setMotions({});
    setFloats([]);
    setDialog(null);
    toast("回到一開始的示意資料");
  };

  return {
    state,
    viewer,
    setViewer,
    dialog,
    open: setDialog,
    close: () => setDialog(null),
    ledger,
    setLedger,
    motions,
    now,
    floats,
    collect,
    remit,
    withdraw,
    confirm,
    reject,
    record,
    reset,
  };
}

export type TownController = ReturnType<typeof useTown>;
