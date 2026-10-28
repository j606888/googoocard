"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetFinanceOverviewQuery } from "@/store/slices/finance";
import { financeHref } from "../routes";
import RemitDialog from "../holder/RemitDialog";
import EntryDialog from "../vault/EntryDialog";
import QuestPanel from "../quests/QuestPanel";
import { fredoka } from "./fonts";
import { TALL, WIDE } from "./layouts";
import { GROUND } from "./palette";
import { crateSlots } from "./scenery";
import styles from "./town.module.css";
import { Backpacks, HudActions, HudTop } from "./TownHud";
import { KeepPanel, LegendPanel, PersonPanel } from "./TownPanels";
import TownScene from "./TownScene";
import { buildTownView } from "./townView";
import { useTownMotion } from "./useTownMotion";

type Drawer = { kind: "keep" } | { kind: "person"; userId: number } | { kind: "legend" };

/** 量元素的寬度（地圖縮小時，泡泡要反向放大才讀得到）。 */
function useElementWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const CRATE_CAPACITY = crateSlots(WIDE).length;

/**
 * 水庫的遊戲畫面「奇異鳥小鎮」（docs/finance-game-style.md），資料是真的（GET finance/overview）。
 * 電腦（expanded）橫式地圖＋疊在上面的 HUD；手機（compact）直式地圖，數字黏在上面、背包列黏在下面。
 * 不做縮放。對帳、找某一筆用帳本模式（/finance/ledger）。
 */
export default function Town() {
  const router = useRouter();
  const wide = useSizeClass() === "expanded";
  const { data: overview } = useGetFinanceOverviewQuery(undefined, { pollingInterval: 30_000 });
  const { data: me } = useGetMeQuery();
  const { data: locations } = useGetLocationsQuery();
  const [measure, width] = useElementWidth();
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [shown, setShown] = useState<Drawer | null>(null);
  const [remitting, setRemitting] = useState(false);
  const [recording, setRecording] = useState(false);

  const view = useMemo(() => {
    if (!overview || !me) return null;
    const regions = (locations?.locations ?? [])
      .filter((l) => !l.archivedAt)
      .map((l) => ({ title: l.name, sub: l.address ?? "分部" }));
    return buildTownView(overview, me.id, { slotCount: WIDE.slots.length, crateCapacity: CRATE_CAPACITY, regions });
  }, [overview, me, locations]);
  const { motions, now, floats, markConfirmed } = useTownMotion(view?.carts);

  // 關抽屜時內容要留到退場動畫跑完
  if (drawer && drawer !== shown) setShown(drawer);
  const content = drawer ?? shown;

  if (!view) {
    return <Skeleton className="w-full rounded-3xl" style={{ aspectRatio: wide ? "1280 / 800" : "520 / 752" }} />;
  }

  const layout = wide ? WIDE : TALL;
  const scale = width > 0 ? width / layout.viewBox[2] : 1;
  const bubbleScale = clamp(layout.bubbleTarget / scale, 1, 1.6);
  const openLedger = () => router.push(financeHref.ledger);
  const openPerson = (userId: number) => setDrawer({ kind: "person", userId });
  const openKeep = () => setDrawer({ kind: "keep" });
  const remit = () => {
    setDrawer(null);
    setRemitting(true);
  };

  const scene = (
    <TownScene
      layout={layout}
      view={view}
      motions={motions}
      now={now}
      floats={floats}
      bubbleScale={bubbleScale}
      onKeep={openKeep}
      onPerson={openPerson}
      className={wide ? "absolute inset-0 size-full" : "block h-auto w-full"}
    />
  );
  const actions = (variant: "round" | "bar") => (
    <HudActions view={view} variant={variant} onLedger={openLedger} onMine={() => openPerson(view.viewer.id)} onRemit={remit} onExpense={() => setRecording(true)} />
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <div className={cn(styles.root, fredoka.variable)}>
        {wide ? (
          // 不做縮放：整張地圖永遠放得進一個畫面，所以寬度同時受視窗高度限制
          <div
            ref={measure}
            className="@container relative mx-auto w-full overflow-hidden rounded-3xl"
            style={{ aspectRatio: "1280 / 800", maxWidth: "min(1280px, calc((100dvh - 180px) * 1.6))", background: GROUND }}
          >
            {scene}
            <HudTop view={view} variant="wide" onLedger={openLedger} onLegend={() => setDrawer({ kind: "legend" })} />
            <div className="absolute bottom-28 left-3.5 top-[128px] flex">
              <div className="max-h-full overflow-y-auto rounded-[20px] [scrollbar-width:none]">
                <Backpacks view={view} variant="card" onOpen={openPerson} onKeep={openKeep} />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-3.5">{actions("round")}</div>
          </div>
        ) : (
          <div className="-mx-4 overflow-hidden" style={{ background: GROUND }}>
            <HudTop view={view} variant="tall" onLedger={openLedger} onLegend={() => setDrawer({ kind: "legend" })} />
            <div ref={measure}>{scene}</div>
            <div className="flex items-center gap-2 pb-3 pl-3 pt-2">
              {actions("bar")}
              <Backpacks view={view} variant="strip" onOpen={openPerson} onKeep={openKeep} />
            </div>
          </div>
        )}
      </div>

      <div className="lg:max-w-[420px]">
        <QuestPanel />
      </div>

      <ResponsiveDialog
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        desktop="side"
        className={cn(styles.root, fredoka.variable, "max-h-[90dvh] gap-0 overflow-y-auto bg-[#FFFDF7] p-5 lg:max-h-none")}
      >
        {content?.kind === "keep" && <KeepPanel view={view} onConfirmed={markConfirmed} onClose={() => setDrawer(null)} />}
        {content?.kind === "person" && <PersonPanel view={view} userId={content.userId} onRemit={remit} onClose={() => setDrawer(null)} />}
        {content?.kind === "legend" && <LegendPanel onClose={() => setDrawer(null)} />}
      </ResponsiveDialog>

      {remitting && <RemitDialog open onClose={() => setRemitting(false)} inHand={view.viewer.inHand} ownerName={view.owner?.name ?? "營收負責人"} />}
      {recording && overview && <EntryDialog open onClose={() => setRecording(false)} members={overview.members} />}
    </div>
  );
}
