"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCheckinKeyQuery,
  useRotateCheckinKeyMutation,
} from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PageHeader = () => (
  <div className="print:hidden">
    <h1 className="text-2xl font-bold text-neutral-900">簽到 QR Code</h1>
    <p className="mt-1 text-sm leading-relaxed text-neutral-500">
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
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5 py-6 lg:mx-0 lg:px-8 print:mx-auto">
        <PageHeader />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 p-6">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="aspect-square w-full max-w-[256px] rounded-sm" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="mx-auto h-11 w-40 rounded-xl" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">
        載入失敗，請稍後再試。
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5 py-6 lg:mx-0 lg:px-8 print:mx-auto">
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

      {/* The printable poster. */}
      <div
        id="checkin-poster"
        className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 p-6 text-center"
      >
        <h2 className="text-lg font-semibold">{data.classroomName}</h2>
        <p className="text-sm text-neutral-500">上課簽到</p>
        <QRCodeSVG value={data.url} size={256} className="h-auto w-full max-w-[256px]" />
        <p className="text-sm leading-relaxed text-neutral-600">
          掃描 QR Code → 選擇自己 → 勾選今天上的課
        </p>
      </div>

      <div className="flex flex-col gap-3 print:hidden">
        <div className="truncate rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-900">
          {data.url}
        </div>
        <Button onClick={handleCopy}>
          <Copy className="size-4" />
          複製連結
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" />
          列印看板
        </Button>

        {confirmingRotate ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-warning-300 bg-warning-50 p-4">
            <p className="text-sm leading-relaxed text-warning-950">
              重新產生後，目前貼在教室的 QR Code 會立刻失效，需要重印一張。確定要繼續嗎？
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmingRotate(false)}
                className="flex-1 bg-white"
              >
                取消
              </Button>
              <Button
                variant="danger"
                isLoading={isRotating}
                onClick={handleRotate}
                className="flex-1"
              >
                {isRotating ? "產生中…" : "確定重新產生"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmingRotate(true)}>
            <RefreshCw className="size-4" />
            重新產生 QR Code
          </Button>
        )}
      </div>
    </div>
  );
};

export default CheckinQr;
