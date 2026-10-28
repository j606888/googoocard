"use client";

import { useEffect, useRef } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";

interface MenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Defaults to "bottom-start"; "bottom-end" for a ⋯ button at the right edge. */
  placement?: Placement;
}

const Menu = ({ open, anchorEl, onClose, children, className, placement = "bottom-start" }: MenuProps) => {
  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: anchorEl || undefined,
    },
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, anchorEl]);

  if (!open || !anchorEl) return null;

  // 在 Radix 對話框／抽屜裡打開時要 portal 進那個對話框：modal 對話框會把 body 設成
  // pointer-events: none，portal 到 body 的選單點不到（點擊會穿到後面），也會被當成點外面。
  const dialogRoot = anchorEl.closest<HTMLElement>("[role=dialog]") ?? undefined;

  return (
    <FloatingPortal root={dialogRoot}>
      <div
        ref={(node) => {
          refs.setFloating(node);
          menuRef.current = node;
        }}
        style={floatingStyles}
        className={
          className ??
          "bg-white rounded-2xl border border-neutral-200 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
        }
      >
        {children}
      </div>
    </FloatingPortal>
  );
};

export default Menu;
