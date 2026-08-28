"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { PRIMARY_LINKS, SECONDARY_LINKS } from "./navConfig";
import {
  useGetStudentsQuery,
  useGetUnpaidStudentCardsQuery,
} from "@/store/slices/students";
import MoreSheet from "./MoreSheet";

const BottomNav = () => {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: renewalStudents } = useGetStudentsQuery({ needsRenewal: true });
  const renewalCount = renewalStudents?.length ?? 0;
  const { data: unpaidCards } = useGetUnpaidStudentCardsQuery();
  const unpaidCount = unpaidCards?.length ?? 0;

  // "More" counts as active when on a secondary page.
  const moreActive = SECONDARY_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="pointer-events-auto mx-3 mb-3 flex items-center justify-around gap-1 rounded-[26px] border border-black/5 bg-white/80 px-2 py-2 shadow-[0_10px_30px_-8px_rgba(27,94,74,0.35)] backdrop-blur-xl">
          {PRIMARY_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            let badge: number | undefined;
            if (link.href === "/students" && renewalCount > 0) badge = renewalCount;
            if (link.href === "/income" && unpaidCount > 0) badge = unpaidCount;
            return (
              <NavTab
                key={link.name}
                href={link.href}
                label={link.name}
                Icon={link.icon}
                active={active}
                badge={badge}
              />
            );
          })}
          <NavTab
            as="button"
            onClick={() => setMoreOpen(true)}
            label="更多"
            Icon={MoreHorizontal}
            active={moreActive}
          />
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
};

interface NavTabProps {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
  href?: string;
  as?: "link" | "button";
  onClick?: () => void;
}

const NavTab = ({
  label,
  Icon,
  active,
  badge,
  href,
  as = "link",
  onClick,
}: NavTabProps) => {
  const inner = (
    <span
      className={`relative flex items-center gap-2 rounded-full px-3.5 py-2.5 transition-colors ${
        active ? "text-white" : "text-neutral-400"
      }`}
    >
      {active && (
        <motion.span
          layoutId="bottomNavPill"
          className="absolute inset-0 rounded-full bg-primary-500 shadow-[0_4px_12px_-2px_rgba(43,142,110,0.6)]"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        <span className="relative">
          <Icon className="h-6 w-6 shrink-0" />
          {badge !== undefined && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {badge}
            </span>
          )}
        </span>
        {active && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            className="overflow-hidden whitespace-nowrap text-sm font-semibold"
          >
            {label}
          </motion.span>
        )}
      </span>
    </span>
  );

  const className = "flex flex-1 justify-center cursor-pointer";

  if (as === "button") {
    return (
      <button onClick={onClick} className={className} aria-label={label}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href!} className={className} aria-label={label}>
      {inner}
    </Link>
  );
};

export default BottomNav;
