"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";

/**
 * 現場綁定：小幫手打開這位學生的綁定 QR，學生用 LINE 掃、送出訊息就綁好，
 * 接著就能自助點名。QR 內容就是複製出去的那條綁定連結。
 */
const LineBindQrButton = ({
  deepLink,
  studentName,
  className,
}: {
  deepLink: string;
  studentName: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        顯示 QR
      </button>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)}>
        <div className="relative flex items-center justify-center mb-4">
          <ResponsiveDialogTitle className="text-xl font-semibold">
            {studentName} 的 LINE 綁定
          </ResponsiveDialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            className="absolute -right-2 -top-1.5 text-neutral-500"
            onClick={() => setOpen(false)}
            aria-label="關閉"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        <div className="flex flex-col items-center gap-4 pb-4">
          <QRCodeSVG value={deepLink} size={240} marginSize={2} />
          <p className="text-sm text-neutral-600 text-center leading-relaxed">
            請學生用 LINE 掃描，打開聊天室後按「傳送」就完成綁定。
          </p>
        </div>
      </ResponsiveDialog>
    </>
  );
};

export default LineBindQrButton;
