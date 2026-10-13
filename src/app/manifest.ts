import type { MetadataRoute } from "next";

/**
 * 讓老師可以把 Googoocard「加入主畫面」，以 standalone 模式開啟
 * （沒有 Safari 工具列）。圖示由 kiwi-bird.svg 產生，放在 public/icons/。
 * 引導流程見 src/features/installGuide/。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Googoocard",
    short_name: "Googoocard",
    description: "讓你的教學更輕鬆",
    lang: "zh-Hant-TW",
    // "/" 會依登入狀態導到 /lessons 或 /onboarding
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
