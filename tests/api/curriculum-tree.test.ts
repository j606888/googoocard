import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { findMembershipAccess } from "@/lib/access";
import {
  resetDb,
  createClassroom,
  createMember,
  createDanceStyle,
  enableModule,
  jsonRequest,
  routeParams,
} from "../factories";

// Session read from the DB each call, so module switches and roles are real.
const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => {
    const access = await findMembershipAccess(auth.userId, auth.classroomId);
    return access ? { ...auth, ...access } : { classroomId: -1 };
  },
  createAuthSession: async () => {},
}));

import { GET as STYLES } from "@/app/api/curriculum/styles/route";
import { GET as TREE, POST as CREATE_TREE } from "@/app/api/curriculum/[danceStyleId]/tree/route";
import { POST as CREATE_SKILL } from "@/app/api/curriculum/[danceStyleId]/skills/route";
import { POST as ADD_DRAFTS } from "@/app/api/curriculum/[danceStyleId]/drafts/route";
import { POST as PLACE_DRAFTS } from "@/app/api/curriculum/[danceStyleId]/drafts/place/route";
import { POST as CREATE_TIER } from "@/app/api/curriculum/[danceStyleId]/tiers/route";
import { DELETE as DELETE_CATEGORY } from "@/app/api/curriculum/categories/[id]/route";
import { POST as MOVE_CATEGORY } from "@/app/api/curriculum/categories/[id]/move/route";
import { DELETE as DELETE_TIER } from "@/app/api/curriculum/tiers/[id]/route";
import { PATCH as PATCH_SKILL, DELETE as REMOVE_SKILL } from "@/app/api/curriculum/skills/[id]/route";
import { POST as RESTORE_SKILL } from "@/app/api/curriculum/skills/[id]/restore/route";
import { GET as HISTORY } from "@/app/api/curriculum/skills/[id]/history/route";
import { POST as COMMENT } from "@/app/api/curriculum/skills/[id]/comments/route";
import { POST as MARK_READ } from "@/app/api/curriculum/skills/[id]/read/route";
import { GET as TALK } from "@/app/api/curriculum/[danceStyleId]/talk/route";

const OWNER_ID = 1;
const as = (userId: number) => {
  auth.userId = userId;
};

type Tree = {
  categories: { id: number; name: string; sortOrder: number }[];
  tiers: { id: number; label: string; sortOrder: number }[];
  skills: { id: number; name: string; categoryId: number; tierId: number }[];
  drafts: { id: number; name: string; tierId: number | null }[];
  archived: { id: number; name: string; categoryId: number | null }[];
};

const style = (id: number) => routeParams({ danceStyleId: String(id) });
const byId = (id: number) => routeParams({ id: String(id) });
const tree = async (styleId: number): Promise<Tree> => (await TREE(jsonRequest("GET"), style(styleId))).json();
const createTree = (styleId: number, template = "default") =>
  CREATE_TREE(jsonRequest("POST", { template }), style(styleId));
const createSkill = (styleId: number, body: unknown) => CREATE_SKILL(jsonRequest("POST", body), style(styleId));
const addDrafts = (styleId: number, text: string) => ADD_DRAFTS(jsonRequest("POST", { text }), style(styleId));
const history = async (skillId: number) =>
  (await (await HISTORY(jsonRequest("GET"), byId(skillId))).json()) as { kind: string; fromValue: string | null; toValue: string | null }[];

async function seed({ module = true } = {}) {
  await resetDb();
  const classroom = await createClassroom({ name: "Studio A" });
  auth.classroomId = classroom.id;
  as(OWNER_ID);
  if (module) await enableModule(classroom.id, "curriculum");
  const bachata = await createDanceStyle(classroom.id, { name: "Bachata" });
  const helper = await createMember(classroom.id, { email: "h@test.local", name: "小安", role: "assistant" });
  return { classroom, bachata, helper };
}

/** Default tree; returns the tree. */
async function withTree(styleId: number) {
  expect((await createTree(styleId)).status).toBe(200);
  return tree(styleId);
}

beforeEach(() => as(OWNER_ID));

describe("權限與模組", () => {
  it("模組沒開 → 404 MODULE_NOT_ENABLED", async () => {
    const { bachata } = await seed({ module: false });
    const res = await TREE(jsonRequest("GET"), style(bachata.id));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("MODULE_NOT_ENABLED");
  });

  it("小幫手（只有 view）看得到樹，但改不了 → 403", async () => {
    const { bachata, helper } = await seed();
    const t = await withTree(bachata.id);
    as(helper.id);
    expect((await TREE(jsonRequest("GET"), style(bachata.id))).status).toBe(200);
    const res = await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id });
    expect(res.status).toBe(403);
    expect((await addDrafts(bachata.id, "Side")).status).toBe(403);
  });

  it("別間教室的舞種、技能、分類 → 404", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();

    const other = await createClassroom({ name: "B", email: "b@test.local" });
    await enableModule(other.id, "curriculum");
    auth.classroomId = other.id;
    as(2 + 1); // the other classroom's owner is user 3 (user 2 is 小安)
    expect((await TREE(jsonRequest("GET"), style(bachata.id))).status).toBe(404);
    expect((await PATCH_SKILL(jsonRequest("PATCH", { name: "X" }), byId(skill.id))).status).toBe(404);
    expect(
      (await DELETE_CATEGORY(jsonRequest("DELETE", { moveTo: null }), byId(t.categories[0].id))).status
    ).toBe(404);
  });
});

describe("建立樹", () => {
  it("預設樹：五個分類、一轉到三轉；已經有樹 → 409", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    expect(t.categories.map((c) => c.name)).toEqual(["概念", "單人腳步", "Body Movement", "Footwork", "雙人招式"]);
    expect(t.tiers.map((x) => x.label)).toEqual(["Lv1", "Lv2", "Lv3"]);
    const again = await createTree(bachata.id, "blank");
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("TREE_EXISTS");
  });

  it("空白樹：一個分類、一個等級；入口頁顯示有樹", async () => {
    const { bachata } = await seed();
    await createTree(bachata.id, "blank");
    const t = await tree(bachata.id);
    expect(t.categories).toHaveLength(1);
    expect(t.tiers).toHaveLength(1);
    const styles = await (await STYLES(jsonRequest("GET"), routeParams({}))).json();
    expect(styles[0]).toMatchObject({ hasTree: true, skillCount: 0 });
  });
});

describe("技能", () => {
  it("放進樹要等級；同名 → 409", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const noTier = await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id });
    expect((await noTier.json()).code).toBe("TIER_REQUIRED");
    expect((await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).status).toBe(200);
    const dup = await createSkill(bachata.id, { name: " basic " });
    expect(dup.status).toBe(409);
  });

  it("改名、換分類、換等級都寫進修改紀錄（存人看得懂的字）", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();
    const res = await PATCH_SKILL(
      jsonRequest("PATCH", { name: "Basic step", categoryId: t.categories[1].id, tierId: t.tiers[1].id, description: "基本步" }),
      byId(skill.id)
    );
    expect(res.status).toBe(200);
    const log = await history(skill.id);
    expect(log.map((c) => [c.kind, c.fromValue, c.toValue])).toEqual(
      expect.arrayContaining([
        ["add", null, null],
        ["rename", "Basic", "Basic step"],
        ["describe", null, null],
        ["move_category", "概念", "單人腳步"],
        ["move_tier", "一轉 · Lv1", "二轉 · Lv2"],
      ])
    );
  });

  it("樹上的技能移除＝封存，還原回原位；修改紀錄都有", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();
    expect(await (await REMOVE_SKILL(jsonRequest("DELETE"), byId(skill.id))).json()).toEqual({ deleted: false });
    let now = await tree(bachata.id);
    expect(now.skills).toHaveLength(0);
    expect(now.archived.map((s) => s.name)).toEqual(["Basic"]);

    expect((await RESTORE_SKILL(jsonRequest("POST"), byId(skill.id))).status).toBe(200);
    now = await tree(bachata.id);
    expect(now.skills.map((s) => s.categoryId)).toEqual([t.categories[0].id]);
    expect((await history(skill.id)).map((c) => c.kind)).toEqual(["restore", "archive", "add"]);
  });
});

describe("待定區", () => {
  it("貼上：去重、跳過已經有的名字、上限 100", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id });
    const res = await addDrafts(bachata.id, "- Basic\n• Side\nside\n1. Hammerlock");
    const body = await res.json();
    expect(body.added.map((s: { name: string }) => s.name)).toEqual(["Side", "Hammerlock"]);
    expect(body.skipped).toEqual(["Basic"]);

    const many = Array.from({ length: 101 }, (_, i) => `move ${i}`).join("\n");
    const tooMany = await addDrafts(bachata.id, many);
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).code).toBe("TOO_MANY_DRAFTS");
  });

  it("沒有樹也能先丟名字進待定區", async () => {
    const { bachata } = await seed();
    expect((await addDrafts(bachata.id, "Side")).status).toBe(200);
    expect((await tree(bachata.id)).drafts.map((d) => d.name)).toEqual(["Side"]);
  });

  it("放進樹後留言和已讀都還在", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const { added } = await (await addDrafts(bachata.id, "Side\nCuddle")).json();
    const [side, cuddle] = added as { id: number }[];
    await COMMENT(jsonRequest("POST", { text: "這個要先教" }), byId(side.id));
    await MARK_READ(jsonRequest("POST"), byId(side.id));

    const res = await PLACE_DRAFTS(
      jsonRequest("POST", { ids: [side.id, cuddle.id], categoryId: t.categories[1].id, tierId: t.tiers[0].id }),
      style(bachata.id)
    );
    expect(await res.json()).toEqual({ placed: [side.id, cuddle.id], skipped: [] });
    const now = await tree(bachata.id);
    expect(now.drafts).toHaveLength(0);
    expect(now.skills.map((s) => s.id).sort()).toEqual([side.id, cuddle.id].sort());

    const talk = await (await TALK(jsonRequest("GET"), style(bachata.id))).json();
    expect(talk.comments.map((c: { skillId: number }) => c.skillId)).toEqual([side.id]);
    expect(Object.keys(talk.readAt).map(Number)).toEqual([side.id]);
    expect((await history(side.id)).map((c) => [c.kind, c.toValue])).toContainEqual(["place", "單人腳步 · 一轉 · Lv1"]);
  });

  it("樹上已有同名的待定卡被跳過", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const { added } = await (await addDrafts(bachata.id, "Side")).json();
    // A same-named skill reaches the tree some other way (renamed into it).
    const other = await (await createSkill(bachata.id, { name: "Side step", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();
    await prisma.skill.update({ where: { id: other.id }, data: { name: "side" } });
    const res = await PLACE_DRAFTS(
      jsonRequest("POST", { ids: [added[0].id], categoryId: t.categories[0].id, tierId: t.tiers[0].id }),
      style(bachata.id)
    );
    expect(await res.json()).toEqual({ placed: [], skipped: ["Side"] });
  });

  it("刪除待定卡＝真的刪掉，留言一起刪", async () => {
    const { bachata } = await seed();
    const { added } = await (await addDrafts(bachata.id, "Side")).json();
    await COMMENT(jsonRequest("POST", { text: "?" }), byId(added[0].id));
    expect(await (await REMOVE_SKILL(jsonRequest("DELETE"), byId(added[0].id))).json()).toEqual({ deleted: true });
    expect(await prisma.skill.count()).toBe(0);
    expect(await prisma.skillComment.count()).toBe(0);
  });
});

describe("分類與等級", () => {
  it("刪分類：技能搬到別的分類（有紀錄）", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();
    const res = await DELETE_CATEGORY(jsonRequest("DELETE", { moveTo: t.categories[2].id }), byId(t.categories[0].id));
    expect(res.status).toBe(200);
    const now = await tree(bachata.id);
    expect(now.categories).toHaveLength(4);
    expect(now.skills[0].categoryId).toBe(t.categories[2].id);
    expect((await history(skill.id))[0]).toMatchObject({ kind: "move_category", fromValue: "概念", toValue: "Body Movement" });
  });

  it("刪分類：一起封存；還原時回到待定區", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[0].id })).json();
    await DELETE_CATEGORY(jsonRequest("DELETE", { moveTo: null }), byId(t.categories[0].id));
    let now = await tree(bachata.id);
    expect(now.archived.map((s) => [s.name, s.categoryId])).toEqual([["Basic", null]]);
    await RESTORE_SKILL(jsonRequest("POST"), byId(skill.id));
    now = await tree(bachata.id);
    expect(now.drafts.map((s) => s.name)).toEqual(["Basic"]);
  });

  it("最後一個分類、最後一個等級不能刪", async () => {
    const { bachata } = await seed();
    await createTree(bachata.id, "blank");
    const t = await tree(bachata.id);
    const cat = await DELETE_CATEGORY(jsonRequest("DELETE", { moveTo: null }), byId(t.categories[0].id));
    expect((await cat.json()).code).toBe("LAST_CATEGORY");
    const tier = await DELETE_TIER(jsonRequest("DELETE", { moveTo: null }), byId(t.tiers[0].id));
    expect((await tier.json()).code).toBe("LAST_TIER");
  });

  it("刪等級後順序重排（三轉變二轉）", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    const skill = await (await createSkill(bachata.id, { name: "Basic", categoryId: t.categories[0].id, tierId: t.tiers[2].id })).json();
    await DELETE_TIER(jsonRequest("DELETE", { moveTo: t.tiers[0].id }), byId(t.tiers[1].id));
    const now = await tree(bachata.id);
    expect(now.tiers.map((x) => [x.label, x.sortOrder])).toEqual([
      ["Lv1", 0],
      ["Lv3", 1],
    ]);
    expect(now.skills[0].tierId).toBe(t.tiers[2].id);
    expect((await history(skill.id)).map((c) => c.kind)).toEqual(["add"]);
  });

  it("等級最多 10 個", async () => {
    const { bachata } = await seed();
    await withTree(bachata.id);
    for (let i = 0; i < 7; i++) {
      expect((await CREATE_TIER(jsonRequest("POST", { label: "" }), style(bachata.id))).status).toBe(200);
    }
    const res = await CREATE_TIER(jsonRequest("POST", { label: "" }), style(bachata.id));
    expect((await res.json()).code).toBe("TOO_MANY_TIERS");
  });

  it("分類排序", async () => {
    const { bachata } = await seed();
    const t = await withTree(bachata.id);
    await MOVE_CATEGORY(jsonRequest("POST", { dir: -1 }), byId(t.categories[4].id));
    expect((await tree(bachata.id)).categories.map((c) => c.name)).toEqual([
      "概念",
      "單人腳步",
      "Body Movement",
      "雙人招式",
      "Footwork",
    ]);
  });
});
