import { useMemo } from "react";
import { useGetAccessQuery } from "@/store/slices/access";
import type { Module, Permission } from "@/lib/permissions";

/**
 * The signed-in member's permissions in the current classroom, for hiding nav
 * links and buttons. Everything reads `false` until it has loaded — better
 * to appear a moment late than to flash and vanish. Only a convenience: every
 * API route checks the permission again.
 */
export function useAccess() {
  const { data, isLoading } = useGetAccessQuery();
  return useMemo(() => {
    const permissions = new Set(data?.permissions ?? []);
    const modules = new Set(data?.modules ?? []);
    return {
      isLoading,
      role: data?.role,
      can: (permission: Permission) => permissions.has(permission),
      moduleEnabled: (module: Module) => modules.has(module),
    };
  }, [data, isLoading]);
}

export function useCan(permission: Permission): boolean {
  return useAccess().can(permission);
}

export function useModuleEnabled(module: Module): boolean {
  return useAccess().moduleEnabled(module);
}
