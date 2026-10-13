import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/store/provider";
import { Toaster } from "sonner";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Googoocard",
  description: "讓你的教學更輕鬆",
  // 從主畫面開啟時的 App 名稱與狀態列。statusBarStyle "default" 讓內容
  // 從狀態列下方開始，不會被瀏海蓋住。
  appleWebApp: {
    capable: true,
    title: "Googoocard",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 沒有 cover 的話 env(safe-area-inset-*) 一律是 0，BottomNav 在主畫面
  // 模式下會被 Home 指示條壓到。
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster richColors />
        </Providers>
      </body>
    </html>
  );
}
