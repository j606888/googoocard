import { formatCardSerial } from "@/lib/cardSerial";

// 課卡編號標籤（#A0412）。muted 用在已結束／已轉換的卡上。
const CardSerial = ({
  serialNumber,
  muted = false,
  className = "",
}: {
  serialNumber: number;
  muted?: boolean;
  className?: string;
}) => (
  <span
    className={`shrink-0 inline-block rounded-md border px-1.5 text-xs font-semibold tabular-nums tracking-wide ${
      muted
        ? "border-neutral-200 bg-neutral-50 text-neutral-500"
        : "border-neutral-300 bg-white text-neutral-700"
    } ${className}`}
  >
    {formatCardSerial(serialNumber)}
  </span>
);

export default CardSerial;
