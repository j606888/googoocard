import { useState } from "react";
import { ChevronDown, Copy, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const TONE_BUTTON_CLASS: Record<"primary" | "line", string | undefined> = {
  primary: undefined,
  line: "bg-[#06C755] hover:bg-[#06C755]/90",
};

// Shared by "Shared URL" (BasicSection/index.tsx) and the LINE bind link
// (StudentLineBind.tsx) — both are a label + Copy button, with the raw URL
// hidden by default (the teacher almost always just clicks Copy, so showing
// the full string every time was pure clutter). A chevron reveals it when
// someone actually needs to eyeball or manually send the link.
const CopyLinkRow = ({
  label,
  caption,
  value,
  tone,
  copyButtonLabel,
}: {
  label: string;
  caption?: string;
  value: string;
  tone: "primary" | "line";
  copyButtonLabel: string;
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success("已複製");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-neutral-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-700 truncate">{label}</p>
          {caption && <p className="text-xs text-neutral-500 truncate">{caption}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Button type="button" size="sm" className={TONE_BUTTON_CLASS[tone]} onClick={handleCopy}>
            <Copy className="w-4 h-4" />
            <span>{copyButtonLabel}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label={expanded ? "收起連結" : "顯示連結"}
            aria-expanded={expanded}
            className="text-neutral-500"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-xs text-neutral-500 break-all p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
              {value}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CopyLinkRow;
