import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import { talkMarks } from "@/domains/curriculum/talk";
import {
  resetDb,
  createClassroom,
  createMember,
  createDanceStyle,
  enableModule,
  jsonRequest,
  routeParams,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

import { POST as ADD_DRAFTS } from "@/app/api/curriculum/[danceStyleId]/drafts/route";
import { GET as TALK } from "@/app/api/curriculum/[danceStyleId]/talk/route";
import { GET as STYLES } from "@/app/api/curriculum/styles/route";
import { POST as COMMENT } from "@/app/api/curriculum/skills/[id]/comments/route";
import { POST as MARK_READ } from "@/app/api/curriculum/skills/[id]/read/route";
import { PATCH as EDIT, DELETE as REMOVE } from "@/app/api/curriculum/comments/[id]/route";
import { PUT as REACT } from "@/app/api/curriculum/comments/[id]/reaction/route";
import { PUT as CONCLUDE, DELETE as UNCONCLUDE } from "@/app/api/curriculum/comments/[id]/conclusion/route";

const OWNER_ID = 1;
const as = (userId: number) => {
  auth.userId = userId;
};
const byId = (id: number) => routeParams({ id: String(id) });
const style = (id: number) => routeParams({ danceStyleId: String(id) });

type Comment = { id: number; skillId: number; parentId: number | null; text: string; conclusion: unknown; reactions: { kind: string; people: { id: number }[] }[] };

async function seed() {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  auth.classroomId = classroom.id;
  as(OWNER_ID);
  await enableModule(classroom.id, "curriculum");
  const bachata = await createDanceStyle(classroom.id, { name: "Bachata" });
  const mia = await createMember(classroom.id, { email: "mia@test.local", name: "Mia", role: "assistant" });
  const ken = await createMember(classroom.id, { email: "ken@test.local", name: "Ken", role: "assistant" });
  const res = await ADD_DRAFTS(jsonRequest("POST", { text: "Side" }), style(bachata.id));
  const skillId: number = (await res.json()).added[0].id;
  return { classroom, bachata, mia, ken, skillId };
}

const comment = async (skillId: number, text: string, parentId?: number): Promise<Comment> => {
  const res = await COMMENT(jsonRequest("POST", { text, parentId }), byId(skillId));
  expect(res.status).toBe(200);
  return res.json();
};
const talk = async (styleId: number) => (await TALK(jsonRequest("GET"), style(styleId))).json();

beforeEach(() => as(OWNER_ID));

describe("留言", () => {
  it("只有 view 的小幫手可以留言、按表情、標結論", async () => {
    const { mia, skillId } = await seed();
    as(mia.id);
    const c = await comment(skillId, "我覺得要先教");
    expect((await REACT(jsonRequest("PUT", { kind: "like" }), byId(c.id))).status).toBe(200);
    expect((await CONCLUDE(jsonRequest("PUT"), byId(c.id))).status).toBe(200);
  });

  it("回覆的回覆被攤平到同一串", async () => {
    const { skillId } = await seed();
    const root = await comment(skillId, "root");
    const reply = await comment(skillId, "reply", root.id);
    const nested = await comment(skillId, "nested", reply.id);
    expect(reply.parentId).toBe(root.id);
    expect(nested.parentId).toBe(root.id);
  });

  it("回覆別的技能的留言 → 400", async () => {
    const { bachata, skillId } = await seed();
    const other = (await (await ADD_DRAFTS(jsonRequest("POST", { text: "Cuddle" }), style(bachata.id))).json()).added[0];
    const root = await comment(other.id, "root");
    const res = await COMMENT(jsonRequest("POST", { text: "x", parentId: root.id }), byId(skillId));
    expect(res.status).toBe(400);
  });

  it("只有作者能編輯；作者或管理員能刪除", async () => {
    const { mia, ken, skillId } = await seed();
    as(mia.id);
    const c = await comment(skillId, "Mia 說");

    as(ken.id);
    expect((await EDIT(jsonRequest("PATCH", { text: "改掉" }), byId(c.id))).status).toBe(403);
    expect((await REMOVE(jsonRequest("DELETE"), byId(c.id))).status).toBe(403);

    as(mia.id);
    const edited = await (await EDIT(jsonRequest("PATCH", { text: "Mia 改過" }), byId(c.id))).json();
    expect(edited.editedAt).not.toBeNull();

    as(OWNER_ID); // 管理員 (members.manage)
    expect((await REMOVE(jsonRequest("DELETE"), byId(c.id))).status).toBe(200);
    expect(await prisma.skillComment.count()).toBe(0);
  });

  it("刪主留言時回覆一起刪", async () => {
    const { skillId } = await seed();
    const root = await comment(skillId, "root");
    await comment(skillId, "reply", root.id);
    await REMOVE(jsonRequest("DELETE"), byId(root.id));
    expect(await prisma.skillComment.count()).toBe(0);
  });
});

describe("表情", () => {
  it("同一個表情再按一次＝取消；換一個＝覆蓋", async () => {
    const { skillId } = await seed();
    const c = await comment(skillId, "hi");
    expect(await (await REACT(jsonRequest("PUT", { kind: "like" }), byId(c.id))).json()).toEqual({ kind: "like" });
    expect(await (await REACT(jsonRequest("PUT", { kind: "love" }), byId(c.id))).json()).toEqual({ kind: "love" });
    expect(await prisma.skillCommentReaction.count()).toBe(1);
    expect(await (await REACT(jsonRequest("PUT", { kind: "love" }), byId(c.id))).json()).toEqual({ kind: null });
    expect(await prisma.skillCommentReaction.count()).toBe(0);
  });

  it("不認得的表情 → 400", async () => {
    const { skillId } = await seed();
    const c = await comment(skillId, "hi");
    expect((await REACT(jsonRequest("PUT", { kind: "angry" }), byId(c.id))).status).toBe(400);
  });
});

describe("結論", () => {
  it("每個技能只有一則結論", async () => {
    const { bachata, skillId } = await seed();
    const a = await comment(skillId, "a");
    const b = await comment(skillId, "b");
    await CONCLUDE(jsonRequest("PUT"), byId(a.id));
    await CONCLUDE(jsonRequest("PUT"), byId(b.id));
    const { comments } = await talk(bachata.id);
    expect(comments.filter((c: Comment) => c.conclusion).map((c: Comment) => c.id)).toEqual([b.id]);

    await UNCONCLUDE(jsonRequest("DELETE"), byId(b.id));
    expect((await talk(bachata.id)).comments.every((c: Comment) => !c.conclusion)).toBe(true);
  });
});

describe("未讀與 @", () => {
  it("@ 寫進 mention；對方看到紅點，markRead 後紅點和 @ 都清掉", async () => {
    const { bachata, mia, skillId } = await seed();
    await comment(skillId, "@Mia 你看一下");
    expect(await prisma.skillCommentMention.count({ where: { userId: mia.id } })).toBe(1);

    as(mia.id);
    let t = await talk(bachata.id);
    expect(t.mentioned).toEqual([skillId]);
    expect(talkMarks(t, mia.id).get(skillId)?.fresh).toBe(true);
    let styles = await (await STYLES(jsonRequest("GET"), routeParams({}))).json();
    expect(styles[0]).toMatchObject({ openCount: 1, freshCount: 1 });

    await MARK_READ(jsonRequest("POST"), byId(skillId));
    t = await talk(bachata.id);
    expect(t.mentioned).toEqual([]);
    expect(talkMarks(t, mia.id).get(skillId)?.fresh).toBe(false);
    styles = await (await STYLES(jsonRequest("GET"), routeParams({}))).json();
    expect(styles[0].freshCount).toBe(0);
  });

  it("自己的留言不算新留言、@ 自己不記", async () => {
    const { bachata, skillId } = await seed();
    await comment(skillId, "@Owner 自言自語");
    expect(await prisma.skillCommentMention.count()).toBe(0);
    const t = await talk(bachata.id);
    expect(talkMarks(t, OWNER_ID).get(skillId)?.fresh).toBe(false);
  });

  it("編輯時新 @ 的人補記，舊的保留", async () => {
    const { mia, ken, skillId } = await seed();
    const c = await comment(skillId, "@Mia");
    await EDIT(jsonRequest("PATCH", { text: "@Ken 才對" }), byId(c.id));
    const mentioned = (await prisma.skillCommentMention.findMany()).map((m) => m.userId).sort();
    expect(mentioned).toEqual([mia.id, ken.id].sort());
  });
});

it("別間教室的留言 → 404", async () => {
  const { skillId } = await seed();
  const c = await comment(skillId, "hi");
  const other = await createClassroom({ name: "B", email: "b@test.local" });
  await enableModule(other.id, "curriculum");
  auth.classroomId = other.id;
  as(4); // owner of B (users 2, 3 are Mia and Ken)
  expect((await REACT(jsonRequest("PUT", { kind: "like" }), byId(c.id))).status).toBe(404);
  expect((await COMMENT(jsonRequest("POST", { text: "x" }), byId(skillId))).status).toBe(404);
});
