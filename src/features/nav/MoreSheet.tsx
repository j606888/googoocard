"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronRight, LogOut, Smartphone } from "lucide-react";
import {
  ACCOUNT_LINK,
  MODULE_LINKS,
  SECONDARY_LINKS,
  SETTINGS_ENTRY,
  isSettingsPath,
  type NavLink,
} from "./navConfig";
import { useGetMeQuery } from "@/store/slices/me";
import { useAccess } from "@/hooks/useCan";
import { useLogoutMutation } from "@/store/slices/me";
import { disableWebPushOnLogout } from "@/hooks/useWebPush";
import { useInstallState } from "@/hooks/useInstallState";
import InstallGuideDialog from "@/features/installGuide/InstallGuideDialog";
import { Button } from "@/components/ui/button";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const MoreSheet = ({ open, onClose }: MoreSheetProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [logout] = useLogoutMutation();
  const install = useInstallState();
  const { can } = useAccess();
  const visible = (link: NavLink) => !link.permission || can(link.permission);
  const moduleLinks = MODULE_LINKS.filter(visible);
  const { data: me } = useGetMeQuery();
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
                {SECONDARY_LINKS.filter(visible).map((link) => (
                  <Tile key={link.href} link={link} active={pathname.startsWith(link.href)} onClose={onClose} />
                ))}
              </div>

              {moduleLinks.length > 0 && (
                <>
                  <p className="mx-1 mb-2 mt-4 text-xs font-medium text-neutral-500">模組</p>
                  <div className="grid grid-cols-3 gap-3">
                    {moduleLinks.map((link) => (
                      <Tile key={link.href} link={link} active={pathname.startsWith(link.href)} onClose={onClose} />
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 flex flex-col">
                <Row
                  link={SETTINGS_ENTRY}
                  hint="舞種、分部、團隊、簽到 QR"
                  active={isSettingsPath(pathname)}
                  onClose={onClose}
                />
                <Row
                  link={ACCOUNT_LINK}
                  hint={me?.email}
                  active={pathname.startsWith(ACCOUNT_LINK.href)}
                  onClose={onClose}
                />
              </div>

              {install.canGuide && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    onClose();
                    setInstallGuideOpen(true);
                  }}
                  className="mt-3 w-full"
                >
                  <Smartphone />
                  加到主畫面
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                onClick={handleLogout}
                className="mt-3 w-full"
              >
                <LogOut />
                登出
              </Button>

              <p className="mt-5 text-center text-xs font-medium tracking-wide text-neutral-400">
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

const Tile = ({ link, active, onClose }: { link: NavLink; active: boolean; onClose: () => void }) => (
  <Link
    href={link.href}
    onClick={onClose}
    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition-colors ${
      active
        ? "border-primary-300 bg-primary-100 text-primary-900"
        : "border-neutral-200 bg-white text-neutral-600 active:bg-neutral-50"
    }`}
  >
    <link.icon className="h-6 w-6" />
    <span className="text-sm font-medium">{link.name}</span>
  </Link>
);

const Row = ({
  link,
  hint,
  active,
  onClose,
}: {
  link: NavLink;
  hint?: string;
  active: boolean;
  onClose: () => void;
}) => (
  <Link
    href={link.href}
    onClick={onClose}
    className={`flex h-13 items-center gap-3 border-b border-neutral-200 px-1 ${
      active ? "font-semibold text-primary-900" : "text-neutral-900"
    }`}
  >
    <link.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary-700" : "text-neutral-600"}`} />
    <span className="flex-1">{link.name}</span>
    {hint && <span className="truncate text-[13px] font-normal text-neutral-500">{hint}</span>}
    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
  </Link>
);

export default MoreSheet;
