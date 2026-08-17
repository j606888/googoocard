"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCheckinKeyQuery,
  useRotateCheckinKeyMutation,
} from "@/store/slices/classrooms";

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
    return <p className="px-5 py-8 text-center text-sm text-neutral-500">載入中…</p>;
  }
  if (error || !data) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">
        載入失敗，請稍後再試。
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5 py-6">
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

      <div className="print:hidden">
        <h1 className="text-xl font-semibold">簽到 QR Code</h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          印出來貼在教室看板上。學生掃描後選擇自己、勾選今天要上的課即可簽到；
          助教仍需在點名畫面確認後才會定案。
        </p>
      </div>

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
        <div className="truncate rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
          {data.url}
        </div>
        <button
          onClick={handleCopy}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-3 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Copy className="h-4 w-4" />
          複製連結
        </button>
        <button
          onClick={() => window.print()}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-3 text-sm font-medium hover:bg-neutral-50"
        >
          <Printer className="h-4 w-4" />
          列印看板
        </button>

        {confirmingRotate ? (
          <div className="flex flex-col gap-3 rounded-xl bg-warning-50 p-4">
            <p className="text-sm leading-relaxed text-warning-800">
              重新產生後，目前貼在教室的 QR Code 會立刻失效，需要重印一張。確定要繼續嗎？
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingRotate(false)}
                className="flex-1 cursor-pointer rounded-lg border border-neutral-200 bg-white py-2 text-sm"
              >
                取消
              </button>
              <button
                disabled={isRotating}
                onClick={handleRotate}
                className="flex-1 cursor-pointer rounded-lg bg-warning-600 py-2 text-sm font-medium text-white disabled:bg-neutral-300"
              >
                {isRotating ? "產生中…" : "確定重新產生"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingRotate(true)}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm text-neutral-500 hover:bg-neutral-50"
          >
            <RefreshCw className="h-4 w-4" />
            重新產生 QR Code
          </button>
        )}
      </div>
    </div>
  );
};

export default CheckinQr;
