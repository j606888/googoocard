"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

interface BottomSheetDialogProps {
  open: boolean;
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  submitText?: string;
  disabled?: boolean;
}

const Drawer = ({
  title,
  open,
  onClose,
  onSubmit,
  children,
  isLoading,
  disabled = false,
  submitText = "CREATE",
}: BottomSheetDialogProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Background overlay */}
          <motion.div
            className="fixed inset-0 bg-black/70 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog content */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-xl p-4 min-h-70 flex flex-col "
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
          >
            <div className="relative flex items-center justify-center mb-6 ">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button
                className="text-gray-500 absolute right-0 top-0 flex items-center gap-2 cursor-pointer"
                onClick={onClose}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {children}
            </div>
            <div className="mt-auto w-full">
              <button
                disabled={disabled}
                type="submit"
                className={`mt-auto w-full bg-primary-500 text-white font-semibold py-2 rounded flex items-center justify-center gap-2 cursor-pointer hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => !isLoading && onSubmit()}
              >
                <span>{submitText}</span>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
