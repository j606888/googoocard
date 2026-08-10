"use client";

import type { CardMonthlyTotal } from "./types";
import { formatMoney, shortMonthLabel } from "./format";

// 手刻折線圖 — 專案沒有圖表套件,月份資料點少 (最多 12)。
// SVG 只負責「線」與「面積」並用 preserveAspectRatio="none" 撐滿容器
// (搭配 non-scaling-stroke 讓線寬不被拉伸);圓點、文字、點擊熱區都是
// 用百分比定位的 HTML,才不會在寬螢幕被等比放大成巨無霸。
interface Props {
  months: CardMonthlyTotal[]; // 由舊到新
  selectedMonth: string | null;
  onSelectMonth: (month: string) => void;
}

export default function MonthlyRevenueChart({
  months,
  selectedMonth,
  onSelectMonth,
}: Props) {
  if (months.length === 0) return null;

  const max = Math.max(...months.map((m) => m.totalRevenue));

  // 只有一個月時放正中央;max 為 0 時整條線貼底,避免除以 0
  const points = months.map((m, i) => ({
    ...m,
    x: months.length === 1 ? 50 : (i / (months.length - 1)) * 100,
    y: max > 0 ? (1 - m.totalRevenue / max) * 100 : 100,
  }));

  // 熱區以資料點為中心往兩側展開,但要夾在 [0, 100] 內,
  // 否則最左/最右那欄會撐出容器造成整頁橫向捲動。
  const colW = 100 / months.length;
  const hitArea = (x: number) => {
    const left = Math.max(x - colW / 2, 0);
    const right = Math.min(x + colW / 2, 100);
    return { left, width: right - left };
  };

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `M ${points[0].x},100 ${points
    .map((p) => `L ${p.x},${p.y}`)
    .join(" ")} L ${points[points.length - 1].x},100 Z`;

  // 月份多的時候隔一個標一次,但最新的那個月一定要標到
  const showLabel = (i: number) =>
    months.length <= 6 || (months.length - 1 - i) % 2 === 0;

  return (
    <div className="mb-3">
      {max > 0 && (
        <p className="text-xs text-neutral-400 mb-1">${formatMoney(max)}</p>
      )}

      <div className="relative h-32 mx-3">
        {/* 基準線 */}
        {["top-0", "top-1/2", "bottom-0"].map((pos) => (
          <div
            key={pos}
            className={`absolute inset-x-[-0.75rem] ${pos} h-px bg-neutral-200`}
          />
        ))}

        {months.length > 1 && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full overflow-visible"
            aria-hidden="true"
          >
            <path d={area} className="fill-primary-100" opacity={0.6} />
            <polyline
              points={line}
              fill="none"
              className="stroke-primary-500"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {points.map((p) => {
          const selected = p.month === selectedMonth;
          // 點靠近頂端時把金額標到下方,免得被切掉
          const labelBelow = p.y < 25;
          return (
            <div key={p.month}>
              <div
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  selected
                    ? "w-2.5 h-2.5 bg-primary-600 ring-2 ring-white"
                    : "w-1.5 h-1.5 bg-primary-500"
                }`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              />
              {selected && (
                <div
                  className="absolute -translate-x-1/2 text-xs font-semibold text-primary-700 whitespace-nowrap"
                  style={{
                    left: `${Math.min(Math.max(p.x, 8), 92)}%`,
                    top: labelBelow ? `calc(${p.y}% + 10px)` : undefined,
                    bottom: labelBelow ? undefined : `calc(${100 - p.y}% + 10px)`,
                  }}
                >
                  ${formatMoney(p.totalRevenue)}
                </div>
              )}
              {/* 透明點擊熱區:整欄可點,手機才好按 */}
              <button
                type="button"
                onClick={() => onSelectMonth(p.month)}
                aria-label={`${shortMonthLabel(p.month)} $${formatMoney(
                  p.totalRevenue
                )}`}
                className="absolute inset-y-0 cursor-pointer"
                style={{
                  left: `${hitArea(p.x).left}%`,
                  width: `${hitArea(p.x).width}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 月份標籤 */}
      <div className="relative h-5 mx-3 mt-1">
        {points.map((p, i) =>
          showLabel(i) ? (
            <span
              key={p.month}
              className={`absolute -translate-x-1/2 text-xs whitespace-nowrap ${
                p.month === selectedMonth
                  ? "text-primary-700 font-medium"
                  : "text-neutral-400"
              }`}
              style={{ left: `${p.x}%` }}
            >
              {shortMonthLabel(p.month)}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
