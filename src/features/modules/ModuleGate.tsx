"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useCan";
import type { Module, Permission } from "@/lib/permissions";
import { MODULE_INFO } from "./moduleInfo";

/**
 * Wraps a module's pages (its `layout.tsx`): renders them only when the module
 * is on and the member has `permission`. Only the screen — the API checks the
 * same permission on every route.
 */
export default function ModuleGate({
  module,
  permission,
  children,
}: {
  module: Module;
  permission: Permission;
  children: ReactNode;
}) {
  const { isLoading, can, moduleEnabled } = useAccess();
  const name = MODULE_INFO[module].name;

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-4 px-5 py-6 lg:px-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl opacity-50" />
      </div>
    );
  }

  if (!moduleEnabled(module)) {
    return (
      <EmptyState
        title={`這間教室沒有開啟${name}`}
        description={can("modules.manage") ? "可以在「功能模組」頁打開。" : "需要的話請找管理員開啟。"}
        action={
          can("modules.manage") ? (
            <Button asChild>
              <Link href="/modules">去開啟</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (!can(permission)) {
    return <EmptyState title="你沒有權限看這裡" description={`需要的話，請管理員在團隊頁幫你打開「${name}」的權限。`} />;
  }

  return <>{children}</>;
}
