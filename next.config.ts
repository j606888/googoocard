import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 推播的 service worker：每次都跟伺服器確認新版，改了才會生效
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // 第一次來的學生自助登記時用 LINE 頭像（src/app/api/liff/register）
      {
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
    ],
  },
};

export default nextConfig;
