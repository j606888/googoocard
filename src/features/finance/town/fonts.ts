import { Fredoka } from "next/font/google";

/** 小鎮的數字和英文字（style doc §3.3）；中文落到系統字。 */
export const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka", display: "swap" });
