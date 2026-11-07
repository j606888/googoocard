import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** 名字旁的小 LINE 圖示：綠＝已綁定、灰＝還沒綁。 */
const LineBoundIcon = ({ bound, className }: { bound: boolean; className?: string }) => (
  <span
    title={bound ? "已綁定 LINE" : "尚未綁定 LINE"}
    aria-label={bound ? "已綁定 LINE" : "尚未綁定 LINE"}
    className={cn(
      "inline-grid size-[18px] shrink-0 place-items-center rounded-full",
      bound ? "bg-[#06C755] text-white" : "bg-neutral-200 text-neutral-500",
      className
    )}
  >
    <MessageCircle className="size-3" strokeWidth={2.5} />
  </span>
);

export default LineBoundIcon;
