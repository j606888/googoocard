"use client";

import { useEffect, useRef } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from "@floating-ui/react";

interface MenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const Menu = ({ open, anchorEl, onClose, children, className }: MenuProps) => {
  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: anchorEl || undefined,
    },
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
    placement: "bottom-start",
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

  return (
    <FloatingPortal>
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
