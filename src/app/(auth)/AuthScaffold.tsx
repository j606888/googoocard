import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import KiwiLogo from "@/components/KiwiLogo";

const AUTH_PITCH = "學生用 LINE 簽到、堂數自動扣，誰該續卡、誰還沒付錢，一打開就知道。";
const AUTH_POINTS = ["LINE 自助簽到", "自動扣堂", "收款對帳"];

/**
 * Full-screen shell for the auth pages (login / signup / onboarding).
 * Mobile: deep-green header carrying the page title, white rounded sheet below.
 * Desktop (lg+): deep-green brand panel on the left (tagline + kiwi), form on the right.
 * The two headers are static markup, so plain `lg:hidden` / `hidden lg:flex` is fine here
 * (docs/ui-responsive.md: no hooks or state inside).
 */
export default function AuthScaffold({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Mobile back button target; omitted = no back button (e.g. onboarding). */
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-primary-900">
      {/* Mobile header */}
      <header className="lg:hidden relative overflow-hidden h-44 shrink-0 px-3 pt-4 text-white">
        {backHref && (
          <Link
            href={backHref}
            aria-label="返回"
            className="relative z-10 w-11 h-11 grid place-items-center rounded-xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        <div className="absolute left-6 bottom-11 z-10">
          <h1 className="text-[28px] font-black">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-primary-100">{subtitle}</p>}
        </div>
        <div aria-hidden="true" className="absolute -right-10 -top-8 w-48 h-48 rounded-full bg-primary-700" />
        <KiwiLogo className="absolute right-6 top-11 w-24 text-primary-300 -scale-x-100" />
      </header>

      {/* Desktop brand panel */}
      <section
        aria-label="Googoocard"
        className="hidden lg:flex relative overflow-hidden flex-col w-[44%] max-w-[620px] shrink-0 min-h-screen px-14 py-12 text-white"
      >
        <Link href="/" className="relative z-10 flex items-center gap-3 self-start">
          <KiwiLogo className="w-10" />
          <span className="font-bold text-lg tracking-[3px]">GOOGOOCARD</span>
        </Link>
        <div className="relative z-10 mt-24">
          <p className="text-[44px] leading-tight font-black">
            紙本課卡，
            <br />
            可以退休了。
          </p>
          <p className="mt-5 max-w-[420px] text-[17px] leading-relaxed text-primary-100">{AUTH_PITCH}</p>
        </div>
        <div aria-hidden="true" className="absolute -right-32 -bottom-40 w-[520px] h-[520px] rounded-full bg-primary-700" />
        <KiwiLogo className="absolute right-16 bottom-24 w-64 text-primary-300 -scale-x-100" />
        <ul className="absolute left-14 bottom-14 z-10 flex gap-2.5 text-[13px] text-primary-100">
          {AUTH_POINTS.map((point) => (
            <li key={point} className="rounded-full border border-primary-600 px-3 py-1.5">
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Form panel */}
      <main className="flex-1 -mt-6 lg:mt-0 relative bg-white rounded-t-[28px] lg:rounded-none flex flex-col items-center px-6 pt-7 pb-6 lg:px-14 lg:py-12">
        <div className="w-full max-w-[400px] flex flex-1 flex-col lg:flex-none lg:my-auto">
          <div className="hidden lg:block mb-6">
            <h1 className="text-[32px] font-black text-neutral-900">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-neutral-600">{subtitle}</p>}
          </div>
          {children}
        </div>
        <nav className="mt-6 flex gap-5 text-xs text-neutral-500">
          <Link href="/privacy" className="hover:text-neutral-700">隱私權政策</Link>
          <Link href="/terms" className="hover:text-neutral-700">服務條款</Link>
        </nav>
      </main>
    </div>
  );
}

/** The auth pages' primary submit button. */
export const authPrimaryButton =
  "w-full min-h-[52px] rounded-xl bg-primary-900 text-white text-base font-bold cursor-pointer hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
