"use client";

import type { ReactNode } from "react";
import Navbar from "@/features/Navbar";
import SettingsTabs from "@/features/settings/SettingsTabs";

/**
 * 教室設定: 舞種、分部、團隊、功能模組、簽到 QR share one nav entry and this
 * tab bar. A route group, so each page keeps its URL.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="print:hidden">
        <Navbar />
        <SettingsTabs />
      </div>
      {children}
    </>
  );
}
