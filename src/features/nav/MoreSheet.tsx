"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { LogOut, Smartphone } from "lucide-react";
import { SECONDARY_LINKS } from "./navConfig";
import { useLogoutMutation } from "@/store/slices/me";
import { disableWebPushOnLogout } from "@/hooks/useWebPush";
import { useInstallState } from "@/hooks/useInstallState";
import InstallGuideDialog from "@/features/installGuide/InstallGuideDialog";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const MoreSheet = ({ open, onClose }: MoreSheetProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [logout] = useLogoutMutation();
  const install = useInstallState();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  const handleLogout = async () => {
    await disableWebPushOnLogout();
    await logout();
    onClose();
    router.push("/login");
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-white px-5 pb-8 pt-3 shadow-[0_-10px_40px_-12px_rgba(27,94,74,0.45)]"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-200" />

              <div className="grid grid-cols-3 gap-3">
                {SECONDARY_LINKS.map((link) => {
                  const active = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={onClose}
                      className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition-colors ${
                        active
                          ? "border-primary-500 bg-primary-50 text-primary-900"
                          : "border-neutral-100 bg-neutral-50 text-neutral-600 active:bg-neutral-100"
                      }`}
                    >
                      <link.icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{link.name}</span>
                    </Link>
                  );
                })}
              </div>

              {install.canGuide && (
                <button
                  onClick={() => {
                    onClose();
                    setInstallGuideOpen(true);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary-100 bg-primary-50 py-3.5 text-primary-900 active:bg-primary-100"
                >
                  <Smartphone className="h-5 w-5" />
                  <span className="text-sm font-medium">加到主畫面</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 py-3.5 text-neutral-600 active:bg-neutral-100"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">登出</span>
              </button>

              <p className="mt-5 text-center text-xs font-medium tracking-wide text-neutral-300">
                @GOOGOOCARD
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 放在 AnimatePresence 外面：sheet 關掉時對話框才不會跟著卸載 */}
      <InstallGuideDialog
        open={installGuideOpen}
        onClose={() => setInstallGuideOpen(false)}
        state={install.state}
      />
    </>
  );
};

export default MoreSheet;
