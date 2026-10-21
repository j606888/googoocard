import Link from "next/link";

// 不用登入就能看的長文頁（隱私權政策、服務條款）。App Store 審核要求公開網址。
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 bg-white px-5 py-6 lg:py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-primary-700">
          Googoocard
        </Link>
        <Link href="/login" className="font-semibold text-primary-700">
          登入
        </Link>
      </header>
      <article className="flex flex-col gap-4 leading-relaxed text-neutral-700 [&_a]:text-primary-700 [&_a]:underline [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-neutral-900 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h3]:font-bold [&_h3]:text-neutral-900 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-neutral-900 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </article>
      <footer className="flex justify-center gap-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        <Link href="/privacy">隱私權政策</Link>
        <Link href="/terms">服務條款</Link>
      </footer>
    </div>
  );
}
