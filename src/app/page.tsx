import { Check } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readAuthSession } from '@/lib/auth'
import KiwiLogo from '@/components/KiwiLogo'

const POINTS = ['LINE 自助簽到', '自動扣堂', '收款對帳']

/** 示意用的集點課卡：10 格、用掉 6 格（蓋奇異鳥章）。 */
const SAMPLE_USED = 6

const SampleCard = ({ className = '' }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={`bg-[#FFFDF7] text-neutral-900 rounded-[22px] p-5 lg:p-7 shadow-[0_24px_48px_rgba(18,50,42,0.2)] ${className}`}
  >
    <div className="flex items-baseline justify-between">
      <span className="text-[17px] lg:text-xl font-bold">10 堂團體卡</span>
      <span className="text-[13px] lg:text-sm text-neutral-500">#A0070</span>
    </div>
    <div className="grid grid-cols-5 gap-2.5 lg:gap-3 mt-4 lg:mt-5">
      {Array.from({ length: 10 }, (_, i) =>
        i < SAMPLE_USED ? (
          <span key={i} className="aspect-square rounded-full bg-primary-700 grid place-items-center">
            <KiwiLogo className="w-3/5 text-white" />
          </span>
        ) : (
          <span key={i} className="aspect-square rounded-full border-2 border-dashed border-primary-300" />
        )
      )}
    </div>
    <div className="flex items-center justify-between mt-4 lg:mt-5 text-[13px] lg:text-sm">
      <span className="text-neutral-600">
        剩 <b className="text-lg lg:text-[22px] text-neutral-900">{10 - SAMPLE_USED}</b> 堂
      </span>
      <span className="rounded-md bg-primary-100 px-2 py-0.5 font-bold text-primary-900">已付款</span>
    </div>
  </div>
)

export default async function Home() {
  const { userId, classroomId } = await readAuthSession();

  if (userId) {
    redirect(classroomId ? '/lessons' : '/onboarding');
  }

  return (
    <main className="min-h-screen flex flex-col overflow-hidden bg-primary-900 text-white lg:bg-primary-50 lg:text-neutral-900">
      <header className="flex items-center justify-between px-6 pt-7 lg:px-20 lg:pt-8">
        <div className="flex items-center gap-2.5 lg:gap-3 text-white lg:text-primary-900">
          <KiwiLogo className="w-8 lg:w-10" />
          <span className="font-bold tracking-[2.5px] text-[15px] lg:text-xl lg:tracking-[3px]">GOOGOOCARD</span>
        </div>
        <nav className="hidden lg:flex items-center gap-3">
          <Link href="/login" className="px-5 py-3 rounded-xl font-medium text-primary-900 hover:bg-primary-100">
            登入
          </Link>
          <Link href="/signup" className="px-5 py-3 rounded-xl font-bold bg-primary-900 text-white hover:bg-primary-700">
            免費開始
          </Link>
        </nav>
      </header>

      <div className="relative flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:items-center lg:px-20 lg:pb-16">
        <section className="relative z-10 px-6 pt-11 lg:p-0 flex flex-col gap-3.5 lg:gap-7">
          <span className="hidden lg:inline-block self-start rounded-full bg-primary-100 px-3.5 py-1.5 text-sm font-medium text-primary-900">
            給舞蹈教室的課卡管理
          </span>
          <h1 className="text-[38px] lg:text-6xl leading-tight font-black">
            紙本課卡，
            <br />
            可以退休了。
          </h1>
          <p className="text-base lg:text-[19px] leading-relaxed text-primary-100 lg:text-neutral-600 lg:max-w-[520px]">
            學生用 LINE 簽到、堂數自動扣，誰該續卡、誰還沒付錢，一打開就知道。
          </p>
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/signup"
              className="px-8 py-[18px] rounded-2xl bg-primary-900 text-white text-[17px] font-bold hover:bg-primary-700"
            >
              建立我的教室
            </Link>
            <Link
              href="/login"
              className="px-6 py-[18px] rounded-2xl border-[1.5px] border-primary-300 bg-white text-[17px] font-medium text-primary-900 hover:bg-primary-50"
            >
              我已經有帳號
            </Link>
          </div>
          <ul className="hidden lg:flex gap-8 mt-2 text-[15px] text-neutral-600">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check className="w-[18px] h-[18px] text-primary-700" strokeWidth={2.6} />
                {point}
              </li>
            ))}
          </ul>
        </section>

        {/* 課卡示意 */}
        <section aria-label="課卡示意" className="relative mx-6 mt-8 lg:m-0 lg:h-[560px]">
          <div aria-hidden="true" className="absolute -right-24 -top-32 w-72 h-72 rounded-full bg-primary-700 lg:hidden" />
          <div aria-hidden="true" className="hidden lg:block absolute inset-[40px_0_0_60px] rounded-[48px] bg-primary-500" />
          <div aria-hidden="true" className="hidden lg:block absolute -right-16 -top-2 w-56 h-56 rounded-full bg-primary-300" />
          <SampleCard className="relative -rotate-2 lg:absolute lg:left-0 lg:top-[120px] lg:w-[420px] lg:-rotate-[4deg]" />
          <div aria-hidden="true" className="hidden lg:flex absolute right-6 top-[400px] w-[300px] items-center gap-3 rounded-[18px] bg-white p-4 shadow-[0_16px_32px_rgba(18,50,42,0.16)]">
            <span className="w-11 h-11 rounded-xl bg-[#06C755] text-white text-[13px] font-bold grid place-items-center">LINE</span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">林佳穎 已簽到</span>
              <span className="text-[13px] text-neutral-500">Bachata Lv2 · 扣 1 堂，剩 4 堂</span>
            </span>
          </div>
          <div aria-hidden="true" className="hidden lg:block absolute right-[70px] top-[500px] rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
            需續約 6 位 · 未付款 3 位
          </div>
        </section>

        <div className="flex-1 lg:hidden" />

        {/* 手機：底部白色面板 */}
        <nav className="lg:hidden relative mt-8 rounded-t-[28px] bg-white px-6 pt-6 pb-8 flex flex-col gap-3 text-neutral-900">
          <Link
            href="/signup"
            className="min-h-[54px] rounded-2xl bg-primary-900 text-white text-[17px] font-bold grid place-items-center"
          >
            建立我的教室
          </Link>
          <Link
            href="/login"
            className="min-h-[54px] rounded-2xl border-[1.5px] border-primary-300 text-primary-900 text-[17px] font-bold grid place-items-center"
          >
            登入
          </Link>
          <p className="mt-1 text-center text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-neutral-700">隱私權政策</Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="hover:text-neutral-700">服務條款</Link>
          </p>
        </nav>
      </div>
    </main>
  );
}
