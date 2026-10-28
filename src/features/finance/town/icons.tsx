/** 小鎮 HUD 用的小圖示（HTML 裡的 inline SVG）。 */

import { TOWN } from "./palette";

export function CoinIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="11" fill={TOWN.coin} />
      <circle cx="12" cy="12" r="7.8" fill="none" stroke={TOWN.coinRim} strokeWidth="1.6" />
      <text x="12" y="16.6" fontSize="12.5" fontWeight="700" textAnchor="middle" fill={TOWN.coinText}>
        $
      </text>
    </svg>
  );
}

export function KeepIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M6 11h12v10H6z" fill="#F1EADF" />
      <path d="M4 11.5 12 4l8 7.5z" fill={TOWN.keepRoof[2]} />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4z" fill={TOWN.door} />
      <path d="M12 4V1.2" stroke="#4D4239" strokeWidth="1.2" />
      <path d="M12 1.3l4 1.3-4 1.3z" fill={TOWN.flag} />
    </svg>
  );
}

export function CartIcon({ size = 26, className = "shrink-0" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3" y="9" width="14" height="7" rx="2" fill="#D9A86C" />
      <ellipse cx="10" cy="8" rx="4.4" ry="3.2" fill={TOWN.sack} />
      <circle cx="7" cy="18" r="2.4" fill="#6B5D50" />
      <circle cx="14" cy="18" r="2.4" fill="#6B5D50" />
      <path d="M17 12h3l1.6 3" stroke="#6B5D50" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function HammerIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12.5 9.5l2 2-8 8a1.4 1.4 0 0 1-2 0 1.4 1.4 0 0 1 0-2z" fill="#C9935A" />
      <path d="M10.5 5.5 14 2.5l7.5 7.5-3 3.5z" fill="#9AA7B4" />
      <path d="M10.5 5.5 14 2.5l2 2-3.5 3z" fill="#B8C3CD" />
    </svg>
  );
}

/** 台南丁丁家。 */
export function HouseIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M5 11h14v10H5z" fill="#FFF6E6" />
      <path d="M3 12 12 4l9 8z" fill={TOWN.coral} />
      <path d="M10 21v-5h4v5z" fill="#C98E5F" />
      <circle cx="12" cy="10" r="1.6" fill={TOWN.glass} />
    </svg>
  );
}

/** 高雄租的教室。 */
export function StudioIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M4 8h16v13H4z" fill="#D6ECE4" />
      <path d="M3 6h18v3H3z" fill="#FBF8F1" />
      <path d="M4 12h16l-1.5 2.5h-13z" fill={TOWN.awning} />
      <path d="M7 15h3v6H7z" fill="#9CC6DA" />
      <path d="M12.5 15H18v4h-5.5z" fill="#CDE9F1" />
    </svg>
  );
}

/** 預收（灰）、待發（橘）、水庫基金（綠）的小箱子。 */
export const CRATE_TONES = {
  prepaid: ["#EEE9DF", "#DAD3C6", "#C5BDAF"],
  payable: ["#FAD2B4", "#EDB38C", "#D99A70"],
  fund: ["#A9E0C6", "#7CC9A6", "#5DB48D"],
} as const;

export function CrateIcon({ tone, size = 22 }: { tone: keyof typeof CRATE_TONES; size?: number }) {
  const [top, left, right] = CRATE_TONES[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 3l9 4.5-9 4.5-9-4.5z" fill={top} />
      <path d="M3 7.5l9 4.5v9l-9-4.5z" fill={left} />
      <path d="M21 7.5l-9 4.5v9l9-4.5z" fill={right} />
    </svg>
  );
}
