import { notFound } from "next/navigation";
import { isLineMockEnabled } from "@/lib/lineMock";
import LineSimulator from "@/features/devLine/LineSimulator";

// LINE 模擬器：用不同的 LINE 身分走 LIFF 流程，不用手機也不用 LINE Developers。
// 只在模擬模式存在（NEXT_PUBLIC_LINE_MOCK=1，且不是 production）。
export default function LineSimulatorPage() {
  if (!isLineMockEnabled()) notFound();
  return <LineSimulator />;
}
