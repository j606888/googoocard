"use client";

import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * 一份表單的兩種走法：手機一路往下捲、桌面拆成並排的分區卡片。
 *
 * 這是 L3（資訊架構真的不同，不只是換排列），所以用 `useSizeClass()`
 * 二選一渲染，**只掛一棵樹**——表單狀態在呼叫端，兩邊共用同一份。
 *
 * 分區標題只有桌面顯示：手機一路捲下來時，欄位本身的 label 已經夠了，
 * 多一層標題反而把畫面切碎。
 */
export interface Step {
  key: string;
  /** 分區標題（只有桌面顯示）。 */
  title: string;
  /** 標題右邊的附註，例如「已新增 3 個時段」（只有桌面顯示）。 */
  aside?: React.ReactNode;
  content: React.ReactNode;
}

const StepFlow = ({
  steps,
  submit,
  columns = "1fr",
  className = "",
}: {
  steps: Step[];
  /**
   * 送出按鈕。桌面收在第一個分區卡片內（跟著主要欄位走），
   * 手機放在所有分區之後——兩邊都是原本的位置。
   */
  submit?: React.ReactNode;
  /** 桌面的 grid track，例如 `"3fr 2fr"`。 */
  columns?: string;
  className?: string;
}) => {
  const isExpanded = useSizeClass() === "expanded";

  if (!isExpanded) {
    return (
      <div className={cn("px-5 py-5 flex flex-col gap-5", className)}>
        {steps.map((step) => (
          <div key={step.key} className="flex flex-col gap-4">
            {step.content}
          </div>
        ))}
        {submit}
      </div>
    );
  }

  return (
    <div
      className={cn("px-8 pb-8 grid gap-8 items-start", className)}
      style={{ gridTemplateColumns: columns }}
    >
      {steps.map((step, index) => (
        <div
          key={step.key}
          className="flex flex-col gap-4 bg-white border border-neutral-100 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between -mb-1">
            <span className="text-base font-semibold text-neutral-800">
              {step.title}
            </span>
            {step.aside && (
              <span className="text-sm text-neutral-400">{step.aside}</span>
            )}
          </div>
          {step.content}
          {index === 0 && submit}
        </div>
      ))}
    </div>
  );
};

export default StepFlow;
