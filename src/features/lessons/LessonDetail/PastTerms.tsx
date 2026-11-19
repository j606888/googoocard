import Link from "next/link";
import type { TermLink } from "./useTermPage";

/** 同課種的其他期：橫向一排，點了就進那一期。沒有其他期就不出現。 */
const PastTerms = ({ terms, currentLessonId }: { terms: TermLink[]; currentLessonId: number }) => {
  const others = terms.filter((term) => term.lessonId !== currentLessonId);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="past-terms-heading" className="pt-2">
      <h3 id="past-terms-heading" className="px-5 text-[13px] font-bold text-neutral-700">
        其他期
      </h3>
      <ul className="mt-2 flex gap-2 overflow-x-auto px-5 pb-2">
        {others.map((term) => (
          <li key={term.lessonId} className="shrink-0">
            <Link
              href={`/lessons/${term.lessonId}`}
              className="block w-[136px] rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 hover:bg-neutral-50"
            >
              <span className="block text-sm font-bold text-neutral-900">第 {term.number} 期</span>
              <span className="block truncate text-xs tabular-nums text-neutral-600">{term.range}</span>
              <span className={`block text-xs ${term.running ? "font-semibold text-primary-900" : "text-neutral-600"}`}>
                {term.totalPeriods} 堂 · {term.running ? "進行中" : "已結束"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PastTerms;
