"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import SegmentedTabs from "@/components/SegmentedTabs";
import StatusTag from "@/components/StatusTag";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { financeHref } from "../routes";
import { fredoka } from "./fonts";
import { TALL, WIDE } from "./layouts";
import { GROUND } from "./palette";
import styles from "./town.module.css";
import TownLedger from "./TownLedger";
import { Backpacks, HudActions, HudTop } from "./TownHud";
import { CollectForm, ExpenseForm, KeepPanel, LegendPanel, PersonPanel, PlacePanel, RemitForm } from "./TownPanels";
import TownScene from "./TownScene";
import { holdingOf, MEMBERS, type MemberId } from "./townModel";
import { useTown, type TownDialog } from "./useTown";

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

/**
 * 水庫「奇異鳥小鎮」示意版（docs/finance-game-style.md）。
 * 電腦（expanded）橫式地圖＋疊在上面的 HUD；手機（compact）直式地圖，數字黏在上面、背包列黏在下面。
 * 兩個外殼共用 `useTown()`，一次只掛一個（docs/ui-responsive.md 規則 1、2）。不做縮放。
 */
export default function Town() {
  const town = useTown();
  const wide = useSizeClass() === "expanded";
  const [measure, width] = useElementWidth();
  const { state, viewer, dialog } = town;

  // 關抽屜時內容要留到退場動畫跑完
  const [shown, setShown] = useState<TownDialog | null>(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  const content = dialog ?? shown;

  const layout = wide ? WIDE : TALL;
  const scale = width > 0 ? width / layout.viewBox[2] : 1;
  const bubbleScale = clamp(layout.bubbleTarget / scale, 1, 1.6);
  const openLedger = () => {
    town.close();
    town.setLedger(true);
  };

  const scene = (
    <TownScene
      layout={layout}
      state={state}
      viewer={viewer}
      motions={town.motions}
      now={town.now}
      floats={town.floats}
      bubbleScale={bubbleScale}
      onKeep={() => town.open({ kind: "keep" })}
      onPerson={(id) => town.open({ kind: "person", id })}
      onPlace={(place) => town.open({ kind: "place", place })}
      className={wide ? "absolute inset-0 size-full" : "block h-auto w-full"}
    />
  );
  const actions = (variant: "round" | "bar") => (
    <HudActions
      state={state}
      viewer={viewer}
      variant={variant}
      onLedger={openLedger}
      onMine={() => town.open({ kind: "person", id: viewer })}
      onRemit={() => town.open({ kind: "remit" })}
      onExpense={() => town.open({ kind: "expense" })}
    />
  );

  return (
    <div className={cn(styles.root, fredoka.variable, "flex w-full flex-col")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#EADFCB] bg-[#FFFDF7] px-4 py-2.5 lg:px-6">
        <span className="text-[15px] font-black">水庫 · 奇異鳥小鎮</span>
        <StatusTag tone="warning">示意版：假資料，重新整理就還原</StatusTag>
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
          <span className="text-[13px] text-neutral-500">用誰的身分看</span>
          <SegmentedTabs<MemberId>
            ariaLabel="用誰的身分看"
            value={viewer}
            onChange={town.setViewer}
            options={MEMBERS.map((m) => ({ value: m.id, label: m.name }))}
          />
          <Button size="sm" variant="secondary" onClick={() => town.open({ kind: "collect" })}>
            模擬：學生付錢
          </Button>
          <Button size="sm" variant="ghost" onClick={town.reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            重來
          </Button>
          <Link href={financeHref("dashboard")} className="text-[13px] font-medium text-primary-700 underline-offset-4 hover:underline">
            舊版頁面
          </Link>
        </div>
      </div>

      {town.ledger ? (
        <TownLedger state={state} onBack={() => town.setLedger(false)} />
      ) : wide ? (
        <div className="px-4 py-4 lg:px-6">
          {/* 不做縮放：整張地圖永遠放得進一個畫面，所以寬度同時受視窗高度限制 */}
          <div
            ref={measure}
            className="@container relative mx-auto w-full overflow-hidden rounded-3xl"
            style={{ aspectRatio: "1280 / 800", maxWidth: "min(1280px, calc((100dvh - 92px) * 1.6))", background: GROUND }}
          >
            {scene}
            <HudTop state={state} variant="wide" onLedger={openLedger} onLegend={() => town.open({ kind: "legend" })} />
            <div className="absolute bottom-28 left-3.5 top-[128px] flex">
              <div className="max-h-full overflow-y-auto rounded-[20px] [scrollbar-width:none]">
                <Backpacks state={state} variant="card" onOpen={(id) => town.open({ kind: "person", id })} />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-3.5">{actions("round")}</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[560px]" style={{ background: GROUND }}>
          <div className="sticky top-15 z-20" style={{ background: GROUND }}>
            <HudTop state={state} variant="tall" onLedger={openLedger} onLegend={() => town.open({ kind: "legend" })} />
          </div>
          <div ref={measure}>{scene}</div>
          <div className="sticky bottom-24 z-20 flex items-center gap-2 pb-2 pl-3 pt-4" style={{ background: `linear-gradient(transparent, ${GROUND} 30%)` }}>
            {actions("bar")}
            <Backpacks state={state} variant="strip" onOpen={(id) => town.open({ kind: "person", id })} />
          </div>
        </div>
      )}

      <ResponsiveDialog
        open={dialog !== null}
        onClose={town.close}
        desktop="side"
        className={cn(styles.root, fredoka.variable, "max-h-[90dvh] gap-0 overflow-y-auto bg-[#FFFDF7] p-5 lg:max-h-none")}
      >
        {content?.kind === "keep" && (
          <KeepPanel state={state} viewer={viewer} onConfirm={town.confirm} onReject={town.reject} onWithdraw={town.withdraw} onLedger={openLedger} onClose={town.close} />
        )}
        {content?.kind === "person" && (
          <PersonPanel state={state} id={content.id} viewer={viewer} onRemit={() => town.open({ kind: "remit" })} onWithdraw={town.withdraw} onClose={town.close} />
        )}
        {content?.kind === "remit" && <RemitForm key={viewer} member={viewer} holding={holdingOf(state, viewer)} onSubmit={town.remit} onClose={town.close} />}
        {content?.kind === "expense" && <ExpenseForm onSubmit={town.record} onClose={town.close} />}
        {content?.kind === "collect" && <CollectForm onSubmit={town.collect} onClose={town.close} />}
        {content?.kind === "legend" && <LegendPanel onClose={town.close} />}
        {content?.kind === "place" && <PlacePanel state={state} place={content.place} onPerson={(id) => town.open({ kind: "person", id })} onClose={town.close} />}
      </ResponsiveDialog>
    </div>
  );
}
