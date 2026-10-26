import { moneyText } from "../Money";
import { Panel, PanelTitle } from "../ui";
import type { WeeklyFigure } from "../types";

const BAR_MAX_HEIGHT = 140;

/** 每週收支：兩根 CSS 長條（收入 primary-500、支出 warning-300）。 */
export default function WeeklyChart({ weeks }: { weeks: WeeklyFigure[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => [w.income, w.expense]));

  return (
    <Panel className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle>每週收支</PanelTitle>
        <div className="flex gap-4 text-[13px] text-neutral-500">
          <Legend color="bg-primary-500">收入</Legend>
          <Legend color="bg-warning-300">支出</Legend>
        </div>
      </div>
      <div
        className="grid items-end gap-3 border-b border-neutral-200"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, height: BAR_MAX_HEIGHT + 16 }}
      >
        {weeks.map((week) => (
          <div
            key={week.label}
            role="img"
            aria-label={`${week.label}：收入 ${moneyText(week.income)}、支出 ${moneyText(week.expense)}`}
            className="flex items-end justify-center gap-1.5"
          >
            <div
              className="w-5 rounded-t-sm bg-primary-500 lg:w-7"
              style={{ height: (week.income / max) * BAR_MAX_HEIGHT }}
              title={`收入 ${moneyText(week.income)}`}
            />
            <div
              className="w-5 rounded-t-sm bg-warning-300 lg:w-7"
              style={{ height: (week.expense / max) * BAR_MAX_HEIGHT }}
              title={`支出 ${moneyText(week.expense)}`}
            />
          </div>
        ))}
      </div>
      <div
        className="grid gap-3 text-center text-[13px] text-neutral-500"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week) => (
          <div key={week.label}>{week.label}</div>
        ))}
      </div>
    </Panel>
  );
}

function Legend({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${color}`} />
      {children}
    </span>
  );
}
