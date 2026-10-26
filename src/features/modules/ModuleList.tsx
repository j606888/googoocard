"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { useCan } from "@/hooks/useCan";
import { MODULES, type Module } from "@/lib/permissions";
import {
  useGetClassroomModulesQuery,
  useSetClassroomModuleMutation,
} from "@/store/slices/classroomModules";
import { MODULE_INFO } from "./moduleInfo";

const CardSkeleton = ({ fade = "" }: { fade?: string }) => (
  <li className={`flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 ${fade}`}>
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="ml-auto h-[1.15rem] w-8" />
    </div>
    <Skeleton className="h-3.5 w-full" />
    <Skeleton className="h-3.5 w-2/3" />
  </li>
);

/** /modules：開關這間教室的功能模組。 */
const ModuleList = () => {
  const canManage = useCan("modules.manage");
  const { data, isLoading } = useGetClassroomModulesQuery();
  const [setModule, { isLoading: saving }] = useSetClassroomModuleMutation();
  const [confirmOff, setConfirmOff] = useState<Module | null>(null);

  const toggle = async (module: Module, enabled: boolean) => {
    try {
      await setModule({ module, enabled }).unwrap();
      toast.success(`已${enabled ? "開啟" : "關閉"}${MODULE_INFO[module].name}`);
      setConfirmOff(null);
    } catch {
      toast.error("操作失敗，請稍後再試");
    }
  };

  const states = new Map(data?.map((m) => [m.module, m]));

  return (
    <div className="w-full px-5 py-3 lg:max-w-[720px] lg:px-8 lg:py-6">
      <h2 className="mb-1 text-2xl font-bold text-neutral-900">功能模組</h2>
      <p className="mb-5 text-sm text-neutral-600">
        點名、課卡、收入是每間教室都有的核心功能。下面這些可以依需要開啟，沒開的教室完全看不到。
      </p>

      {!isLoading && !canManage && (
        <EmptyState kind="inline" title="只有管理員可以開關功能模組" className="mb-4" />
      )}

      <ul className="flex flex-col gap-3">
        {isLoading && (
          <>
            <CardSkeleton />
            <CardSkeleton fade="opacity-50" />
          </>
        )}
        {!isLoading &&
          MODULES.map((module) => {
            const info = MODULE_INFO[module];
            const state = states.get(module);
            const enabled = state?.enabled ?? false;
            return (
              <li key={module} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                    <info.icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-lg font-bold text-neutral-900">{info.name}</span>
                    {enabled ? (
                      <StatusTag tone="positive">已開啟</StatusTag>
                    ) : (
                      <StatusTag tone="neutral">未開啟</StatusTag>
                    )}
                  </span>
                  <Switch
                    aria-label={`${enabled ? "關閉" : "開啟"}${info.name}`}
                    checked={enabled}
                    disabled={!canManage || saving}
                    onCheckedChange={(next) => (next ? toggle(module, true) : setConfirmOff(module))}
                  />
                </div>
                <p className="text-sm leading-relaxed text-neutral-600">{info.summary}</p>
                <dl className="flex flex-col gap-1 text-[13px] leading-relaxed text-neutral-500">
                  <div>
                    <dt className="inline font-medium text-neutral-700">開了會多什麼：</dt>
                    <dd className="inline">{info.adds}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-700">誰看得到：</dt>
                    <dd className="inline">{info.who}</dd>
                  </div>
                </dl>
                {enabled && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 text-[13px] text-neutral-500">
                    <span>
                      {state?.enabledAt && `${format(new Date(state.enabledAt), "yyyy/M/d")} `}
                      {state?.enabledBy ? `由 ${state.enabledBy.name} 開啟` : "已開啟"}
                    </span>
                    <Link href={info.href} className="font-medium text-primary-700 hover:underline">
                      前往{info.name} →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
      </ul>

      <ConfirmDialog
        open={confirmOff !== null}
        title={confirmOff ? `關閉${MODULE_INFO[confirmOff].name}？` : ""}
        message="側欄的入口會消失，所有人都看不到。資料會保留，重新開啟就回來。"
        confirmLabel="關閉"
        variant="danger"
        isLoading={saving}
        onConfirm={() => confirmOff && toggle(confirmOff, false)}
        onCancel={() => setConfirmOff(null)}
      />
    </div>
  );
};

export default ModuleList;
