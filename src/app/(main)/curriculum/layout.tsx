"use client";

import type { ReactNode } from "react";
import Navbar from "@/features/Navbar";
import ModuleGate from "@/features/modules/ModuleGate";

export default function CurriculumLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <ModuleGate module="curriculum" permission="curriculum.view">
        {children}
      </ModuleGate>
    </>
  );
}
