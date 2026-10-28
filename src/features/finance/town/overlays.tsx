/**
 * 疊在世界上的白色泡泡、名牌、看板（style doc §3.5）。
 * `k` 是反向放大倍率：地圖縮小時泡泡維持可讀（地圖上的字至少 11px）。
 */

import type { ReactNode } from "react";
import { INK, PAPER, SUB, TOWN } from "./palette";

/** 以 (ax, ay) 為中心放大 k 倍。 */
export function Scaled({ ax, ay, k, children }: { ax: number; ay: number; k: number; children: ReactNode }) {
  if (k === 1) return <>{children}</>;
  return <g transform={`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) scale(${k.toFixed(3)}) translate(${(-ax).toFixed(1)} ${(-ay).toFixed(1)})`}>{children}</g>;
}

/** 下面有小尾巴的白色泡泡；`bottom` 是尾巴尖端。內容用泡泡左上角當原點。 */
export function Bubble({ cx, bottom, w, h, children, fill = PAPER }: { cx: number; bottom: number; w: number; h: number; children: ReactNode; fill?: string }) {
  const x0 = cx - w / 2;
  const y0 = bottom - 8 - h;
  return (
    <g>
      <g filter="url(#town-soft)">
        <rect x={x0} y={y0} width={w} height={h} rx={Math.min(h / 2, 16)} fill={fill} />
        <path d={`M${cx - 7} ${y0 + h - 0.5} L${cx} ${bottom} L${cx + 7} ${y0 + h - 0.5}z`} fill={fill} />
      </g>
      <g transform={`translate(${x0} ${y0})`}>{children}</g>
    </g>
  );
}

export function NameTag({ x, y, label, tone = "plain" }: { x: number; y: number; label: string; tone?: "plain" | "wait" }) {
  const w = 14 + label.length * 13;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={20} rx={10} fill={tone === "wait" ? "#FFF3E2" : PAPER} opacity={0.95} />
      <text x={x} y={y + 14.2} fontSize={12.5} fontWeight={700} textAnchor="middle" fill={tone === "wait" ? TOWN.waitText : INK}>
        {label}
      </text>
    </g>
  );
}

export function CoinGlyph({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={TOWN.coin} />
      <circle cx={x} cy={y} r={r * 0.7} fill="none" stroke={TOWN.coinRim} strokeWidth={1.5} />
      <text x={x} y={y + r * 0.42} fontSize={r * 1.15} fontWeight={700} textAnchor="middle" fill={TOWN.coinText}>
        $
      </text>
    </g>
  );
}

export function KeepGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={13} fill="#E3F7F0" />
      <path d="M-6.5 0h13v8.5h-13z" fill="#F6F1E8" />
      <path d="M-8.5 .5 0-7l8.5 7.5z" fill={TOWN.keepRoof[2]} />
      <path d="M-1.8 8.5v-3.5a1.8 1.8 0 0 1 3.6 0v3.5z" fill={TOWN.door} />
    </g>
  );
}

/** 小小的跳動驚嘆號：等確認。 */
export function Alert({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <g className="town-bob">
        <circle r={13} fill={TOWN.wait} stroke={PAPER} strokeWidth={3} />
        <text y={6.5} fontSize={18} fontWeight={700} textAnchor="middle" fill="#FFFFFF">
          !
        </text>
      </g>
    </g>
  );
}

/** 電腦版的地區看板（白色、畫面座標）。 */
export function RegionBanner({ x, y, title, sub, dot }: { x: number; y: number; title: string; sub: string; dot: string }) {
  const w = Math.max(30 + title.length * 15 + 14, 18 + sub.length * 11.5) + 18;
  return (
    <g>
      <g filter="url(#town-soft)">
        <rect x={x} y={y} width={w} height={48} rx={14} fill={PAPER} />
      </g>
      <circle cx={x + 18} cy={y + 17} r={6} fill={dot} />
      <circle cx={x + 18} cy={y + 17} r={2.4} fill={PAPER} />
      <text x={x + 30} y={y + 22} fontSize={15} fontWeight={700} fill={INK}>
        {title}
      </text>
      <text x={x + 12} y={y + 40} fontSize={11.5} fill={SUB}>
        {sub}
      </text>
    </g>
  );
}

/** 手機版的地區木牌（插在地上）。 */
export function RegionSign({ x, y, title }: { x: number; y: number; title: string }) {
  return (
    <g>
      <rect x={x - 2.5} y={y - 6} width={5} height={12} rx={2} fill="#B98858" />
      <g filter="url(#town-soft)">
        <rect x={x - 34} y={y - 32} width={68} height={28} rx={8} fill="#EBC593" />
      </g>
      <rect x={x - 30} y={y - 28} width={60} height={20} rx={6} fill="none" stroke="#D9A86C" strokeWidth={1.5} />
      <text x={x} y={y - 12.5} fontSize={15} fontWeight={700} textAnchor="middle" fill="#6B4A2E">
        {title}
      </text>
    </g>
  );
}

/** 推車泡泡裡的沙漏條：等了幾天／期限。 */
export function WaitBar({ x, y, ratio, label }: { x: number; y: number; ratio: number; label: string }) {
  const w = 90;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 h8 l-4 5 l4 5 h-8 l4 -5z" fill="#6B5D50" />
      <rect x={14} y={1} width={w} height={8} rx={4} fill="#F6E5C6" />
      <rect x={14} y={1} width={Math.max(8, w * Math.min(1, ratio))} height={8} rx={4} fill={ratio >= 1 ? TOWN.late : "url(#town-stripe)"} />
      <text x={w + 20} y={9} fontSize={11} fontWeight={700} fill={ratio >= 1 ? TOWN.lateText : TOWN.waitText}>
        {label}
      </text>
    </g>
  );
}
