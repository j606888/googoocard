"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Just enough of LINE's Flex renderer for the /dev/line chat to show what the
 * bot replies: bubble / carousel / box / text / separator / button / filler,
 * plus quick replies. Only the properties src/lib/line.ts and lineFlex.ts emit
 * are honoured — it's a preview, not a spec implementation.
 */
export type FlexNode = Record<string, unknown> & { type: string };
export type FlexAction = { type: string; label?: string; data?: string; uri?: string; displayText?: string; text?: string };

const SIZE: Record<string, number> = { xxs: 10, xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 };
const SPACE: Record<string, number> = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };
const BUBBLE_WIDTH: Record<string, number> = { nano: 120, micro: 160, kilo: 260, mega: 300, giga: 340 };

const space = (v: unknown) => (typeof v === "string" ? SPACE[v] ?? parseInt(v) : undefined);

function flexStyle(node: FlexNode, parentLayout?: string): CSSProperties {
  const flex = node.flex as number | undefined;
  const style: CSSProperties = {};
  if (parentLayout === "horizontal" || parentLayout === "baseline") {
    style.flex = flex === undefined ? "1 1 0" : flex === 0 ? "0 0 auto" : `${flex} ${flex} 0`;
    style.minWidth = 0;
  } else if (flex !== undefined && flex > 0) {
    style.flex = `${flex} ${flex} 0`;
  }
  if (node.margin) style.marginTop = space(node.margin);
  return style;
}

function Node({
  node,
  parentLayout,
  onAction,
}: {
  node: FlexNode;
  parentLayout?: string;
  onAction: (a: FlexAction) => void;
}): ReactNode {
  const action = node.action as FlexAction | undefined;
  const clickable = action ? { onClick: () => onAction(action), role: "button", className: "cursor-pointer" } : {};

  switch (node.type) {
    case "box": {
      const layout = node.layout as string;
      const style: CSSProperties = {
        ...flexStyle(node, parentLayout),
        display: "flex",
        flexDirection: layout === "vertical" ? "column" : "row",
        alignItems: layout === "baseline" ? "baseline" : undefined,
        gap: space(node.spacing),
        backgroundColor: node.backgroundColor as string | undefined,
        padding: space(node.paddingAll),
        paddingTop: space(node.paddingTop),
        paddingBottom: space(node.paddingBottom),
      };
      return (
        <div style={style} {...clickable}>
          {(node.contents as FlexNode[]).map((child, i) => (
            <Node key={i} node={child} parentLayout={layout} onAction={onAction} />
          ))}
        </div>
      );
    }
    case "text":
      return (
        <span
          {...clickable}
          style={{
            ...flexStyle(node, parentLayout),
            fontSize: SIZE[(node.size as string) ?? "md"] ?? 15,
            fontWeight: node.weight === "bold" ? 700 : 400,
            color: (node.color as string) ?? "#111",
            textAlign: (node.align as CSSProperties["textAlign"]) ?? undefined,
            whiteSpace: node.wrap ? "pre-wrap" : "nowrap",
            overflow: node.wrap ? undefined : "hidden",
            textOverflow: node.wrap ? undefined : "ellipsis",
            alignSelf: node.gravity === "center" ? "center" : undefined,
          }}
        >
          {node.text as string}
        </span>
      );
    case "separator":
      return <div style={{ height: 1, backgroundColor: (node.color as string) ?? "#e5e5e5", flex: "0 0 auto" }} />;
    case "filler":
      return <div style={{ flex: 1 }} />;
    case "button": {
      const primary = node.style === "primary";
      return (
        <button
          type="button"
          onClick={() => action && onAction(action)}
          style={{
            ...flexStyle(node, parentLayout),
            backgroundColor: primary ? ((node.color as string) ?? "#06c755") : "#f1f1f1",
            color: primary ? "#fff" : "#111",
          }}
          className="w-full cursor-pointer rounded-md py-2 text-sm font-semibold"
        >
          {action?.label}
        </button>
      );
    }
    default:
      return null;
  }
}

function Bubble({ bubble, onAction }: { bubble: FlexNode; onAction: (a: FlexAction) => void }) {
  const width = BUBBLE_WIDTH[(bubble.size as string) ?? "mega"] ?? 300;
  const section = (key: "header" | "body" | "footer") =>
    bubble[key] ? <Node node={bubble[key] as FlexNode} onAction={onAction} /> : null;
  return (
    <div
      style={{ width, minWidth: width }}
      className="flex shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm"
    >
      {section("header")}
      {section("body")}
      {bubble.footer ? <div className="border-t border-neutral-100">{section("footer")}</div> : null}
    </div>
  );
}

/** One bot message: text (with its own quick replies rendered by the chat) or Flex. */
export function BotMessage({ message, onAction }: { message: FlexNode; onAction: (a: FlexAction) => void }) {
  if (message.type === "text") {
    return (
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm shadow-sm">
        {message.text as string}
      </div>
    );
  }
  if (message.type === "flex") {
    const contents = message.contents as FlexNode;
    if (contents.type === "carousel") {
      return (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {(contents.contents as FlexNode[]).map((b, i) => (
            <Bubble key={i} bubble={b} onAction={onAction} />
          ))}
        </div>
      );
    }
    return <Bubble bubble={contents} onAction={onAction} />;
  }
  return <div className="text-xs text-neutral-500">（{message.type} 訊息，模擬器不顯示）</div>;
}

/** The quick-reply chips of the latest message, if any. */
export function quickRepliesOf(message: FlexNode | undefined): FlexAction[] {
  const items = (message?.quickReply as { items?: { action: FlexAction }[] } | undefined)?.items ?? [];
  return items.map((i) => i.action);
}
