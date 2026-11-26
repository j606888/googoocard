"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCheckinKeyQuery,
  useRotateCheckinKeyMutation,
} from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import IpadDisplayCard from "./IpadDisplayCard";

const PageHeader = () => (
  <div className="print:hidden">
    <h1 className="text-[26px] font-semibold text-ink">簽到 QR Code</h1>
    <p className="mt-1 max-w-[480px] text-[13px] leading-relaxed text-ink-3">
      印出來貼在教室門口。學生用手機相機掃描會在 LINE 裡打開：已綁定的直接選課報到，
      第一次來的填暱稱就能報到；沒卡的當場選一張，下課再付款。
      助教仍需在點名畫面確認後才會定案。
    </p>
  </div>
);

// Teacher-facing page for the studio's wall poster. Renders the classroom's
// permanent check-in QR code plus the plain URL, a copy button, a print-friendly
// layout (see the @media print rules below) and a rotate action for when a
// poster leaks and the old link needs killing.
const CheckinQr = () => {
  const { data, isLoading, error } = useGetCheckinKeyQuery();
  const [rotateCheckinKey, { isLoading: isRotating }] =
    useRotateCheckinKeyMutation();
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.url);
    toast.success("已複製簽到連結");
  };

  const handleRotate = async () => {
    try {
      await rotateCheckinKey().unwrap();
      setConfirmingRotate(false);
      toast.success("已產生新的 QR Code，舊看板已失效");
    } catch {
      toast.error("重新產生失敗，請稍後再試");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5 pb-10 pt-3 lg:mx-0 lg:max-w-[1000px] lg:px-12 lg:pt-9 print:mx-auto">
        <PageHeader />
        <div className="flex max-w-[480px] flex-col items-center gap-4 rounded-2xl border border-line p-6">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="aspect-square w-full max-w-[256px] rounded-sm" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="flex max-w-[480px] flex-col gap-3">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-3">
        載入失敗，請稍後再試。
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5 pb-10 pt-3 lg:mx-0 lg:max-w-[1000px] lg:px-12 lg:pt-9 print:mx-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #checkin-poster, #checkin-poster * { visibility: visible; }
          #checkin-poster {
            position: absolute;
            inset: 0;
            margin: 0 auto;
            border: none;
            padding: 0;
          }
          /* Fill the sheet — this is meant to be readable from across the room. */
          #checkin-poster svg {
            width: 70%;
            max-width: none;
            height: auto;
          }
          #checkin-poster h2 { font-size: 2rem; }
        }
      `}</style>

      <PageHeader />

      {/* 桌面：左欄是給學生掃的看板，右欄是 iPad 顯示頁；手機照舊一欄往下排。 */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16">
        <div className="flex flex-col gap-5">
          {/* The printable poster. */}
          <div
            id="checkin-poster"
            className="flex flex-col items-center gap-4 rounded-2xl border border-line p-6 text-center"
          >
            <h2 className="text-lg font-semibold">{data.classroomName}</h2>
            <p className="text-sm text-ink-3">上課簽到</p>
            <QRCodeSVG value={data.url} size={256} className="h-auto w-full max-w-[256px]" />
            <p className="text-sm leading-relaxed text-ink-2">
              掃描 QR Code → 選擇自己 → 勾選今天上的課
            </p>
          </div>

          <div className="flex flex-col gap-3 print:hidden">
            <div className="truncate rounded-lg bg-band px-3 py-2.5 font-mono text-[13px] text-ink">
              {data.url}
            </div>
            <Button onClick={handleCopy}>
              <Copy className="size-4" />
              複製連結
            </Button>
            <Button variant="text" onClick={() => window.print()}>
              <Printer className="size-4" />
              列印看板
            </Button>

          </div>
        </div>
        <div className="flex flex-col gap-5">
          <IpadDisplayCard displayUrl={data.displayUrl} classroomName={data.classroomName} />

          {/* Rarely needed and destructive — deliberately a quiet footer link. */}
          <button
            type="button"
            onClick={() => setConfirmingRotate(true)}
            className="self-center py-3 text-xs text-ink-3 underline underline-offset-2 print:hidden"
          >
            QR Code 外流了？重新產生
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmingRotate}
        title="重新產生簽到 QR Code？"
        message="目前貼在教室的海報與 iPad 顯示頁會立刻失效，學生掃舊的 QR Code 會打不開。你需要重新列印海報、並在 iPad 重新開啟顯示頁。這個動作無法復原。"
        confirmLabel="確定重新產生"
        variant="danger"
        isLoading={isRotating}
        onConfirm={handleRotate}
        onCancel={() => setConfirmingRotate(false)}
      />
    </div>
  );
};

export default CheckinQr;
