"use client";

import { ChevronDown } from "lucide-react";
import Drawer from "./Drawer";
import { Button } from "./ui/button";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * 同一份表單，兩種容器：手機開 `Drawer`、桌面就地展開。
 *
 * 為什麼要分：手機一次處理一個人、彈窗是對的；桌面一次要解掉五個未綁卡
 * 學生，開關五次彈窗等於把手機的互動模型硬搬上來（見 docs/ui-responsive.md
 * 的桌面破口清單）。就地展開讓背景名單一直看得到，也省掉五次往返。
 *
 * 桌面的展開面板用 `w-full` 靠父層的 `flex-wrap` 換到自己那一行，
 * 所以呼叫端的列要是 `flex flex-wrap`。
 */
const ExpandableAction = ({
  triggerLabel,
  title,
  open,
  onOpenChange,
  onSubmit,
  submitText,
  disabled,
  isLoading,
  children,
}: {
  triggerLabel: string;
  /** 手機 Drawer 的標題；桌面展開時當作面板的小標。 */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  submitText: string;
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}) => {
  const isExpanded = useSizeClass() === "expanded";

  const trigger = (
    <Button
      size="sm"
      className="min-w-24 gap-1"
      onClick={() => onOpenChange(!open)}
      aria-expanded={isExpanded ? open : undefined}
    >
      {triggerLabel}
      {isExpanded && (
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      )}
    </Button>
  );

  if (!isExpanded) {
    return (
      <>
        {trigger}
        <Drawer
          title={title}
          open={open}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitText={submitText}
          disabled={disabled}
          isLoading={isLoading}
        >
          {children}
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      {open && (
        <div className="w-full mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-[13px] font-semibold text-neutral-500 mb-3">{title}</p>
          {children}
          <div className="flex justify-end gap-2 mt-4">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => !isLoading && onSubmit()}
              disabled={disabled}
              isLoading={isLoading}
            >
              {isLoading ? "處理中…" : submitText}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpandableAction;
