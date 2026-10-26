import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 水庫子頁的頁首。頁面標題「水庫」在外框（layout），這裡是分頁裡的標題（標題三）、
 * 一行說明、麵包屑（`Button variant="link"`）與右邊的動作。
 */
export default function FinancePageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 上一層：「資金 / 台南小水庫」 */
  crumbs?: { label: string; href: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="上一層" className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
            {crumbs.map((crumb) => (
              <span key={crumb.href} className="inline-flex items-center gap-1.5">
                <Button variant="link" asChild className="text-sm">
                  <Link href={crumb.href}>{crumb.label}</Link>
                </Button>
                <span aria-hidden="true">/</span>
              </span>
            ))}
          </nav>
        )}
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        {description && <p className="text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
