import { Button } from "@/components/ui/button";
import type { DanceLevels } from "@/domains/qualification";
import BuyCardDrawer from "../BuyCardDrawer";
import type { RenewalCandidate } from "./periodSummary";

/** 這堂把卡用完的人：趁人還在教室，下課前提醒續卡，當場就能幫他買。 */
const RenewalNudge = ({
  candidates,
  danceLevelsOf,
}: {
  candidates: RenewalCandidate[];
  /** 買複習卡要看資格；名冊上查得到就帶。 */
  danceLevelsOf: (studentId: number) => DanceLevels | undefined;
}) => {
  if (candidates.length === 0) return null;
  return (
    <section aria-labelledby="renewal-nudge-heading" className="w-full rounded-2xl bg-accent-50 px-4 py-3.5">
      <h3 id="renewal-nudge-heading" className="text-[15px] font-bold text-accent-950">
        下課前可以提醒續卡
      </h3>
      <ul className="mt-1 divide-y divide-accent-200">
        {candidates.map((candidate) => (
          <li key={candidate.studentId} className="flex items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={candidate.studentAvatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-neutral-900">{candidate.studentName}</p>
              <p className="truncate text-xs text-accent-950">{candidate.cardName} 這堂扣完剩 0 堂</p>
            </div>
            <BuyCardDrawer
              student={{
                id: candidate.studentId,
                name: candidate.studentName,
                danceLevels: danceLevelsOf(candidate.studentId),
              }}
              trigger={(open) => (
                <Button variant="secondary" size="sm" onClick={open}>
                  買卡
                </Button>
              )}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RenewalNudge;
