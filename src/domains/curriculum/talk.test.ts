import { describe, expect, it } from "vitest";
import { isOpen, mentionsIn, talkMarks, threadsOf, typingMention, type TalkComment } from "./talk";

const ME = 9;
const c = (id: number, over: Partial<TalkComment> = {}): TalkComment => ({
  id,
  skillId: 1,
  parentId: null,
  authorId: 2,
  author: "B",
  text: String(id),
  createdAt: `2026-10-0${id}T00:00:00.000Z`,
  editedAt: null,
  conclusion: null,
  reactions: [],
  ...over,
});

describe("talkMarks", () => {
  it("counts comments, notices a 結論, and flags what you have not seen", () => {
    const talk = {
      comments: [
        c(1),
        c(2, { authorId: ME }),
        c(3, { skillId: 2, conclusion: { by: "A", at: "x" } }),
        c(4, { skillId: 3, authorId: ME }),
      ],
      readAt: { 1: "2026-10-01T12:00:00.000Z", 2: "2026-10-09T00:00:00.000Z" },
      mentioned: [3],
    };
    const m = talkMarks(talk, ME);
    expect(m.get(1)).toEqual({ count: 2, concluded: false, fresh: false });
    expect(m.get(2)).toEqual({ count: 1, concluded: true, fresh: false });
    expect(m.get(3)).toEqual({ count: 1, concluded: false, fresh: true });
    expect(isOpen(m.get(1))).toBe(true);
    expect(isOpen(m.get(2))).toBe(false);
    expect(talkMarks({ ...talk, readAt: {} }, ME).get(1)!.fresh).toBe(true);
  });
});

describe("threadsOf", () => {
  it("nests replies under their comment, oldest first", () => {
    const t = threadsOf([c(2, { parentId: 1 }), c(1), c(3), c(4, { skillId: 7 })], 1);
    expect(t.map((x) => [x.id, x.replies.map((r) => r.id)])).toEqual([
      [1, [2]],
      [3, []],
    ]);
  });
});

describe("mentions", () => {
  const people = [
    { id: 1, name: "Ken" },
    { id: 2, name: "Ken Lee" },
    { id: 3, name: "Mia" },
  ];
  it("finds people written as @name（已知行為：@Ken Lee 也會標到 Ken）", () => {
    expect(mentionsIn("@Ken Lee 你看一下", people).sort()).toEqual([1, 2]);
    expect(mentionsIn("問一下 @Mia", people)).toEqual([3]);
    expect(mentionsIn("email ken@x.com", people)).toEqual([]);
  });
  it("knows when you are typing an @", () => {
    expect(typingMention("問 @Mi")).toBe("Mi");
    expect(typingMention("@")).toBe("");
    expect(typingMention("a@b")).toBe(null);
    expect(typingMention("@Mia 好")).toBe(null);
  });
});
