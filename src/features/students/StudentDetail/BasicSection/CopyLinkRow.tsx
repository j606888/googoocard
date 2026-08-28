import { useState } from "react";
import { ChevronDown, Copy, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const TONE_BUTTON_CLASS: Record<"primary" | "line", string> = {
  primary: "bg-primary-500 hover:bg-primary-600",
  line: "bg-[#06C755] hover:opacity-90",
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
        <Link2 className="w-4 h-4 text-neutral-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-700 truncate">{label}</p>
          {caption && <p className="text-xs text-neutral-400 truncate">{caption}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            className={`inline-flex items-center gap-1.5 text-xs font-medium text-white rounded-full px-3 py-1.5 cursor-pointer transition-colors ${TONE_BUTTON_CLASS[tone]}`}
            onClick={handleCopy}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copyButtonLabel}</span>
          </button>
          <button
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 cursor-pointer transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
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
