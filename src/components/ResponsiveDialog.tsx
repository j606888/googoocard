"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * 通用的 adaptive 對話框容器：桌面置中彈窗、手機底部抽屜。
 *
 * 只負責遮罩、定位、進退場動畫、focus 管理與 Esc 關閉——
 * **不含標題列與按鈕**，那是呼叫端的事（`Drawer` 就是在這上面加了
 * 標題與送出按鈕的薄包裝）。
 *
 * focus trap / scroll lock / focus 歸位 / Esc / aria 角色全部來自 Radix。
 * 動畫用 CSS keyframes 掛在 `data-state` 上（見 globals.css 的 `rd-*`），
 * 由 Radix 的 Presence 等 animationend 再卸載節點。這裡刻意**不用**
 * framer-motion 的 AnimatePresence + forceMount：實測退場動畫跑完後
 * 節點不會被移除，會留下一層 opacity:0 的全螢幕遮罩吃掉後續點擊。
 */
const ResponsiveDialog = ({
  open,
  onClose,
  children,
  label,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * 對話框的無障礙名稱。呼叫端自己有渲染 `<ResponsiveDialogTitle>` 的話
   * 就不要傳——傳了會有兩個標題。
   */
  label?: string;
  /**
   * 加在面板上的額外 class（例如改最大寬度或內距）。
   * 用 `cn()` 合併，所以會蓋掉下面同族的預設值——Tailwind 的優先序看的是
   * 樣式表順序而不是 class 屬性的順序，直接串字串蓋不掉。
   */
  className?: string;
}) => {
  const isExpanded = useSizeClass() === "expanded";

  const panelClassName = cn(
    "z-50 bg-white shadow-xl p-4 min-h-70 flex flex-col",
    isExpanded
      ? "rd-panel fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-[480px] max-h-[85vh] rounded-2xl"
      : "rd-sheet fixed bottom-0 left-0 right-0 rounded-t-2xl max-w-[480px] mx-auto",
    className
  );

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rd-overlay fixed inset-0 bg-black/70 z-40" />
        {/* aria-describedby={undefined}：這是通用容器，沒有固定的描述段落 */}
        <Dialog.Content className={panelClassName} aria-describedby={undefined}>
          {label && <Dialog.Title className="sr-only">{label}</Dialog.Title>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

/** 呼叫端的可見標題要用這個，Radix 才認得它是對話框的名稱。 */
export const ResponsiveDialogTitle = Dialog.Title;

export default ResponsiveDialog;
