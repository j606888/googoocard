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
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from "@floating-ui/react";
import { fieldControlClass } from "./Field";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** 灰色小字，跟在選項後面（例如「3 堂進行中」）；觸發框上不顯示。 */
  hint?: string;
  disabled?: boolean;
}

/**
 * 下拉選單。不用原生 `<select>`：各平台長得不一樣，也改不了樣式。
 *
 * 觸發框和輸入框同一個外觀（`fieldControlClass`），寬度跟原生一樣撐到最長的選項；
 * 選單用 floating-ui（跟 `Menu` 同一套），鍵盤上下、Enter、Esc、打字跳選項都有。
 * 在 Radix 對話框／抽屜裡會 portal 進那個對話框，理由見 `Menu`。
 * `size`：`md` 48 高，表單用；`sm` 44 高，篩選列與表格內用。
 */
export default function Select<T extends string | number>({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "請選擇",
  id,
  error,
  disabled,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  value?: T;
  /** 不受控用：示意畫面只要能選、不用把值存起來時。 */
  defaultValue?: T;
  onChange?: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** 給 `<label htmlFor>` 用，會放在觸發框上。 */
  id?: string;
  error?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  /** 加在觸發框上，例如 `w-auto`、`flex-1`。 */
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | undefined>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<(HTMLElement | null)[]>([]);
  const isTypingRef = useRef(false);

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
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight, 320)}px`,
          });
        },
      }),
    ],
  });

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setInner(option.value);
    onChange?.(option.value);
    setOpen(false);
  };

  const disabledIndices = options.flatMap((o, i) => (o.disabled ? [i] : []));
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context),
    useRole(context, { role: "select" }),
    useListNavigation(context, {
      listRef,
      activeIndex,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
      onNavigate: setActiveIndex,
      disabledIndices,
      loop: true,
    }),
    useTypeahead(context, {
      listRef: { current: options.map((o) => o.label) },
      activeIndex,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
      onMatch: open ? setActiveIndex : choose,
      onTypingChange: (typing) => {
        isTypingRef.current = typing;
      },
    }),
  ]);

  const triggerRefs = useMergeRefs([refs.setReference, triggerRef]);

  return (
    <>
      <button
        ref={triggerRefs}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? true : undefined}
        {...getReferenceProps()}
        className={cn(
          fieldControlClass(error),
          "flex cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed",
          size === "md" ? "h-12" : "h-11 px-3 text-[15px]",
          open && "border-primary-700 ring-[3px] ring-primary-100",
          className
        )}
      >
        {/* 每個選項疊在同一格、只顯示選中的：寬度跟原生 select 一樣撐到最長的，選了不會跳 */}
        <span className="grid min-w-0 flex-1">
          {options.map((o) => (
            <span key={o.value} aria-hidden="true" className="invisible col-start-1 row-start-1 truncate">
              {o.label}
            </span>
          ))}
          <span className={cn("col-start-1 row-start-1 truncate", !selected && "text-neutral-400")}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <FloatingPortal root={portalRoot}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              id={listId}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-50 flex flex-col overflow-y-auto [scrollbar-width:thin] rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] outline-none"
            >
              {options.map((o, i) => {
                const isSelected = i === selectedIndex;
                return (
                  <div
                    key={o.value}
                    ref={(node) => {
                      listRef.current[i] = node;
                    }}
                    tabIndex={i === activeIndex ? 0 : -1}
                    aria-disabled={o.disabled || undefined}
                    {...getItemProps({
                      active: i === activeIndex,
                      selected: isSelected,
                      onClick: () => choose(i),
                      onKeyDown: (e) => {
                        if (e.key === "Enter" || (e.key === " " && !isTypingRef.current)) {
                          e.preventDefault();
                          choose(i);
                        }
                      },
                    })}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[15px] outline-none",
                      i === activeIndex && "bg-neutral-100",
                      isSelected ? "font-semibold text-primary-900" : "text-neutral-800",
                      o.disabled && "cursor-not-allowed text-neutral-400"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {o.label}
                      {o.hint && <span className="ml-1.5 text-[13px] font-normal text-neutral-500">{o.hint}</span>}
                    </span>
                    {isSelected && <Check aria-hidden="true" className="size-4 shrink-0 text-primary-700" />}
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

/** 選項就是那串文字本身時：`["台南", "高雄"]` → `[{ value: "台南", label: "台南" }, …]`。 */
export const textOptions = (values: readonly string[]): SelectOption<string>[] =>
  values.map((value) => ({ value, label: value }));

/**
 * 給 Radix 對話框／抽屜的 `onEscapeKeyDown`：選單開著時按 Esc 只關選單。
 * Radix 在 capture 階段就聽 Esc，比選單自己的處理早，所以要在對話框這邊擋。
 */
export function keepOpenOnSelectEscape(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.closest("[role=listbox]")) event.preventDefault();
}
