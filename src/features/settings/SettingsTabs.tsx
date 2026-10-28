"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/hooks/useCan";
import { SETTINGS_LINKS } from "@/features/nav/navConfig";

/**
 * The 教室設定 tab bar over 舞種／分部／團隊／功能模組／簽到 QR. Links, not
 * `SegmentedTabs`: each tab is its own page. The page under it keeps its own
 * title, so this stays small — an eyebrow line, not a second heading.
 */
export default function SettingsTabs() {
  const pathname = usePathname();
  const { can } = useAccess();
  const links = SETTINGS_LINKS.filter((link) => !link.permission || can(link.permission));

  return (
    <div className="px-4 pt-3 lg:px-8 lg:pt-6">
      <p className="text-[13px] font-medium text-neutral-500">教室設定</p>
      <nav aria-label="教室設定" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex w-max gap-1 border-b border-neutral-200 lg:w-auto">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3.5 text-sm transition-colors ${
                  active
                    ? "border-primary-600 font-bold text-primary-900"
                    : "border-transparent font-medium text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
