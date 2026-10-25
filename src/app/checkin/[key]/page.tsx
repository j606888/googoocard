import { redirect } from "next/navigation";

// The old wall-poster address. Self check-in now always runs inside LINE (LIFF)
// so every check-in knows who it is — posters printed before the switch keep
// working by bouncing to the LIFF URL with the same classroom key.
export default async function LegacyCheckinPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) {
    redirect(`https://liff.line.me/${liffId}/checkin?key=${encodeURIComponent(key)}`);
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-lg font-semibold">請用 LINE 掃描簽到</h1>
      <p className="text-neutral-500">LINE 簽到尚未設定完成，請找老師或小幫手。</p>
    </div>
  );
}
