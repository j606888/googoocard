"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { keepOpenOnSelectEscape } from "./Select";

/**
 * 桌面版的右側抽屜：點了列表上的一筆才滑出來看詳情，背景**調暗不模糊**——
 * 看詳情時常常還想瞄一眼後面的列表（例如比價），模糊會把它整個擋掉。
 *
 * 只負責遮罩、定位、動畫與 focus 管理（全部來自 Radix，跟 `ResponsiveDialog`
 * 同一套 `rd-*` keyframes 做法）；標題列與內容是呼叫端的事。
 * 只給 expanded 版型用——手機上詳情是整頁，不是抽屜。
 */
const SideSheet = ({
  open,
  onClose,
  children,
  label,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 無障礙名稱；呼叫端有渲染 `<SideSheetTitle>` 的話就不要傳。 */
  label?: string;
  className?: string;
}) => (
  <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="rd-overlay fixed inset-0 bg-neutral-900/30 z-50" />
      <Dialog.Content
        aria-describedby={undefined}
        onEscapeKeyDown={keepOpenOnSelectEscape}
        // sonner 的 toast 在抽屜外（右下角，正好蓋住抽屜底部），點到它不該被當成點外面而關掉抽屜
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault();
        }}
        className={cn(
          "rd-side fixed top-0 right-0 bottom-0 z-50 w-[520px] max-w-full bg-white shadow-2xl flex flex-col",
          className
        )}
      >
        {label && <Dialog.Title className="sr-only">{label}</Dialog.Title>}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export const SideSheetTitle = Dialog.Title;

export default SideSheet;
