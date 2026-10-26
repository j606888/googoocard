/**
 * 技能討論的純邏輯（docs/modules-plan.md 第 2 階段），從 teach-what `src/lib/talk.ts` 整份搬過來，
 * id 改成 googoocard 的整數。留言掛在技能上——待定區的卡也是技能，所以不用分兩種 target。
 */

export type Reaction = "like" | "love" | "haha" | "wow" | "think" | "down";
export const REACTIONS: { id: Reaction; char: string; label: string }[] = [
  { id: "like", char: "👍", label: "讚" },
  { id: "love", char: "❤️", label: "愛心" },
  { id: "haha", char: "😂", label: "哈哈" },
  { id: "wow", char: "😮", label: "哇" },
  { id: "think", char: "🤔", label: "想想" },
  { id: "down", char: "👎", label: "不太同意" },
];
export const REACTION_IDS = REACTIONS.map((r) => r.id) as [Reaction, ...Reaction[]];

export const COMMENT_MAX = 2000;

export type Person = { id: number; name: string };
export type TalkComment = {
  id: number;
  skillId: number;
  parentId: number | null;
  authorId: number | null;
  author: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  conclusion: { by: string; at: string } | null;
  reactions: { kind: Reaction; people: Person[] }[];
};
/** readAt: when you last opened each skill's 討論. mentioned: skills where someone @-ed you since. */
export type Talk = { comments: TalkComment[]; readAt: Record<number, string>; mentioned: number[] };

export const EMPTY_TALK: Talk = { comments: [], readAt: {}, mentioned: [] };

export type TalkMark = { count: number; concluded: boolean; fresh: boolean };

/**
 * Per skill: how many comments, whether one is the 結論, and whether there is news for you
 * (a comment by someone else since you last looked, or an @ to you).
 */
export function talkMarks(talk: Talk, me: number) {
  const marks = new Map<number, TalkMark>();
  for (const c of talk.comments) {
    const m = marks.get(c.skillId) ?? {
      count: 0,
      concluded: false,
      fresh: talk.mentioned.includes(c.skillId),
    };
    const read = talk.readAt[c.skillId];
    marks.set(c.skillId, {
      count: m.count + 1,
      concluded: m.concluded || !!c.conclusion,
      fresh: m.fresh || (c.authorId !== me && (!read || c.createdAt > read)),
    });
  }
  return marks;
}

/** 討論中: talked about and no 結論 yet. */
export const isOpen = (m: { count: number; concluded: boolean } | undefined) =>
  !!m && m.count > 0 && !m.concluded;

/** Top-level comments oldest first, each with its replies oldest first. */
export function threadsOf(comments: TalkComment[], skillId: number) {
  const mine = comments
    .filter((c) => c.skillId === skillId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return mine.filter((c) => !c.parentId).map((c) => ({ ...c, replies: mine.filter((r) => r.parentId === c.id) }));
}

/**
 * People named in the text as @名字; longer names first. A plain substring match, so "@Ken Lee"
 * also tags "Ken" — teach-what's known behaviour, kept on purpose (see talk.test.ts).
 */
export function mentionsIn(text: string, people: Person[]) {
  return [...people]
    .sort((a, b) => b.name.length - a.name.length)
    .filter((p) => p.name && text.includes(`@${p.name}`))
    .map((p) => p.id);
}

/** The @word being typed at the end of the box, for suggestions; null when not typing one. */
export const typingMention = (text: string) => /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1] ?? null;
