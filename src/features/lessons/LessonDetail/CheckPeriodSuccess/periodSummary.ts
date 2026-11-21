/** 點名完成頁的純推導：標題怎麼講、跟上一堂比、下課前該提醒誰續卡。 */

/** 剛送出：全員到齊就慶祝一下；回頭看紀錄就只是紀錄。 */
export const summaryHeadline = ({
  justSubmitted,
  attended,
  absent,
}: {
  justSubmitted: boolean;
  attended: number;
  absent: number;
}): string => {
  if (!justSubmitted) return "點名紀錄";
  return attended > 0 && absent === 0 ? "全員到齊！" : "點名完成";
};

/**
 * 「比上一堂多 3 人」。上一堂不一定是上週（停課、改期），所以講「上一堂」。
 * 第一堂沒得比 → null。
 */
export const headcountDeltaLabel = (
  /** 已點名時段的出席人數，由舊到新，含這一堂。 */
  takenHeadcounts: { periodId: number; attended: number }[],
  periodId: number
): string | null => {
  const index = takenHeadcounts.findIndex((entry) => entry.periodId === periodId);
  if (index <= 0) return null;
  const delta = takenHeadcounts[index].attended - takenHeadcounts[index - 1].attended;
  if (delta === 0) return "跟上一堂一樣多";
  return delta > 0 ? `比上一堂多 ${delta} 人` : `比上一堂少 ${-delta} 人`;
};

export interface RenewalCandidate {
  studentId: number;
  studentName: string;
  studentAvatarUrl: string;
  cardName: string;
}

/**
 * 這堂扣完剩 0 堂的人——下課前提醒續卡。
 * `remainingSessions` 是課卡**現在**的剩餘數，所以只有最近點名的那一堂（`isLatest`）才能列；
 * 回頭看舊時段時他可能早就續了。付單堂的不算。
 */
export const renewalCandidates = (
  records: {
    studentId: number;
    studentName: string;
    studentAvatarUrl: string;
    cardName?: string | null;
    remainingSessions?: number | null;
    dropIn?: unknown;
  }[],
  isLatest: boolean
): RenewalCandidate[] =>
  isLatest
    ? records
        .filter((record) => record.cardName && !record.dropIn && record.remainingSessions === 0)
        .map(({ studentId, studentName, studentAvatarUrl, cardName }) => ({
          studentId,
          studentName,
          studentAvatarUrl,
          cardName: cardName!,
        }))
    : [];
