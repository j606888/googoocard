"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size as sizeMiddleware,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole,
} from "@floating-ui/react";
import type { SelectOption } from "@/components/Select";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

/**
 * 「給誰」選擇器：外觀跟 `Select` 的觸發框一樣，展開後每一組（老師／公積金／場地）
 * 一個小標題、底下的選項排成會換行的標籤（像尺寸 S / M / L），不用捲動。單選。
 * 浮層做法同 `Select`：floating-ui＋portal 進最近的對話框，所以抽屜裡不會被裁掉、點得到。
 * 鍵盤：方向鍵在標籤間移動、Enter／空白選取、Esc 關閉並把焦點還給觸發框。
 */
export default function PayeePicker({
  value,
  onChange,
  options,
  placeholder = "請選擇",
  className,
  "aria-label": ariaLabel,
}: {
  value?: string;
  onChange: (value: string) => void;
  /** 用 `group` 分組（相鄰同組併成一段）。 */
  options: SelectOption<string>[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | undefined>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (next) setPortalRoot(triggerRef.current?.closest<HTMLElement>("[role=dialog]") ?? undefined);
      setOpen(next);
    },
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      sizeMiddleware({
        padding: 8,
        apply({ rects, elements, availableHeight, availableWidth }) {
          Object.assign(elements.floating.style, {
            minWidth: `${Math.min(Math.max(rects.reference.width, 320), availableWidth)}px`,
            maxWidth: `${availableWidth}px`,
            maxHeight: `${Math.min(availableHeight, 420)}px`,
          });
        },
      }),
    ],
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "select" }),
  ]);
  const triggerRefs = useMergeRefs([refs.setReference, triggerRef]);

  const choose = (o: SelectOption<string>) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
  };

  const focusChip = (from: number, step: 1 | -1) => {
    const n = options.length;
    for (let k = 1; k <= n; k++) {
      const j = (from + step * k + n * k) % n;
      if (!options[j].disabled) {
        chipRefs.current[j]?.focus();
        return;
      }
    }
  };

  const runs: { group?: string; items: { option: SelectOption<string>; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.items.push({ option, index });
    else runs.push({ group: option.group, items: [{ option, index }] });
  });
  const firstFocusable = Math.max(
    0,
    options.findIndex((o) => o.value === value && !o.disabled)
  );

  return (
    <>
      <button
        ref={triggerRefs}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        {...getReferenceProps()}
        className={cn(
          fieldControlClass(),
          "flex h-11 cursor-pointer items-center gap-2 px-3 text-left text-[15px]",
          open && "border-primary-700 ring-[3px] ring-primary-100",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-neutral-400")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <FloatingPortal root={portalRoot}>
          <FloatingFocusManager context={context} modal={false} initialFocus={0}>
            <div
              id={listId}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({
                onKeyDown: (e) => {
                  const idx = chipRefs.current.findIndex((c) => c === document.activeElement);
                  if (idx < 0) return;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    focusChip(idx, 1);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    focusChip(idx, -1);
                  }
                },
              })}
              className="z-50 flex flex-col gap-3 overflow-y-auto [scrollbar-width:thin] rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] outline-none"
            >
              {runs.map((run) => {
                const headerId = `${listId}-g${run.items[0].index}`;
                return (
                  <div key={headerId} role="group" aria-labelledby={run.group ? headerId : undefined} className="flex flex-col gap-1.5">
                    {run.group && (
                      <div id={headerId} role="presentation" className="text-[13px] font-medium text-neutral-500">
                        {run.group}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {run.items.map(({ option: o, index: i }) => {
                        const isSelected = o.value === value;
                        return (
                          <button
                            key={o.value}
                            ref={(node) => {
                              chipRefs.current[i] = node;
                            }}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={o.disabled}
                            tabIndex={i === firstFocusable ? 0 : -1}
                            onClick={() => choose(o)}
                            className={cn(
                              "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:text-neutral-400",
                              isSelected
                                ? "border-primary bg-primary-50 font-semibold text-primary-900"
                                : "border-neutral-200 text-neutral-800 hover:bg-neutral-50"
                            )}
                          >
                            {isSelected && <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary-700" />}
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
