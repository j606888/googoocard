"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { keepOpenOnSelectEscape } from "./Select";
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
  desktop = "panel",
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
   * 桌面怎麼出現：`panel` 置中彈窗（預設）；`side` 從右邊滑出的抽屜（跟 `SideSheet` 同一個樣子），
   * 背景調暗不模糊，看詳情時還瞄得到後面的列表。手機兩種都是底部抽屜。
   */
  desktop?: "panel" | "side";
  /**
   * 加在面板上的額外 class（例如改最大寬度或內距）。
   * 用 `cn()` 合併，所以會蓋掉下面同族的預設值——Tailwind 的優先序看的是
   * 樣式表順序而不是 class 屬性的順序，直接串字串蓋不掉。
   */
  className?: string;
}) => {
  const isExpanded = useSizeClass() === "expanded";
  const side = isExpanded && desktop === "side";

  const panelClassName = cn(
    "z-50 bg-white shadow-xl p-4 min-h-70 flex flex-col",
    side
      ? "rd-side fixed top-0 right-0 bottom-0 w-[520px] max-w-full shadow-2xl"
      : isExpanded
        ? "rd-panel fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-[480px] max-h-[85vh] rounded-2xl"
        : "rd-sheet fixed bottom-0 left-0 right-0 rounded-t-2xl max-w-[480px] mx-auto",
    className
  );

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* 遮罩跟面板同一層 z-50，誰在上面看 DOM 順序：後開的對話框（確認框、疊上去的抽屜）連遮罩一起蓋住先開的 */}
        <Dialog.Overlay className={cn("rd-overlay fixed inset-0 z-50", side ? "bg-neutral-900/30" : "bg-black/70")} />
        {/* aria-describedby={undefined}：這是通用容器，沒有固定的描述段落 */}
        <Dialog.Content
          className={panelClassName}
          aria-describedby={undefined}
          onEscapeKeyDown={keepOpenOnSelectEscape}
          // sonner 的 toast 在右下角，正好蓋住側邊抽屜的底部；點到它不該被當成點外面而關掉
          onInteractOutside={(e) => {
            if ((e.target as Element | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault();
          }}
        >
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
