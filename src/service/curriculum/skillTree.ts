import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { danceStyleSummarySelect } from "@/lib/danceStyles";
import { findDanceStyleInClassroom } from "@/lib/authz";
import { parseId } from "@/lib/apiRoute";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_TIERS,
  MAX_DRAFT_PASTE,
  MAX_TIERS,
  draftNames,
  nameKey,
  reorder,
  sorted,
  tierName,
  unusedColor,
  type SkillChangeKind,
} from "@/domains/curriculum/skillTree";

type Tx = Prisma.TransactionClient;
type Scope = { classroomId: number; danceStyleId: number };

const skillSelect = {
  id: true,
  categoryId: true,
  tierId: true,
  name: true,
  fullName: true,
  description: true,
  sortOrder: true,
  createdAt: true,
  archivedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

const categorySelect = { id: true, name: true, color: true, icon: true, sortOrder: true } as const;
const tierSelect = { id: true, label: true, sortOrder: true } as const;

/** Everything the tree page draws for one 舞種. Drafts are skills with no 分類; archived ones keep theirs. */
export async function loadSkillTree({ classroomId, danceStyleId }: Scope) {
  const [danceStyle, categories, tiers, skills] = await Promise.all([
    prisma.danceStyle.findFirstOrThrow({ where: { id: danceStyleId, classroomId }, select: danceStyleSummarySelect }),
    prisma.skillCategory.findMany({
      where: { classroomId, danceStyleId },
      select: categorySelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.skillTier.findMany({
      where: { classroomId, danceStyleId },
      select: tierSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.skill.findMany({
      where: { classroomId, danceStyleId },
      select: skillSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    danceStyle,
    categories,
    tiers,
    skills: skills.filter((s) => !s.archivedAt && s.categoryId !== null),
    drafts: skills.filter((s) => !s.archivedAt && s.categoryId === null),
    archived: skills.filter((s) => s.archivedAt),
  };
}

// ---------------------------------------------------------------------------
// Lookups: every id from the client is checked against the caller's classroom
// (404 when it's someone else's, like src/lib/authz.ts).

/** The `[danceStyleId]` of a route, checked against the classroom. Archived styles still open. */
export async function styleScope(rawId: string, classroomId: number): Promise<Scope> {
  const danceStyleId = parseId(rawId, "dance style id");
  if (!(await findDanceStyleInClassroom(danceStyleId, classroomId))) {
    throw new ApiError(404, "DANCE_STYLE_NOT_FOUND", "Dance style not found");
  }
  return { classroomId, danceStyleId };
}

export async function findSkillInClassroom(id: number, classroomId: number) {
  const skill = await prisma.skill.findFirst({ where: { id, classroomId } });
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
  return skill;
}

export async function findCategoryInClassroom(id: number, classroomId: number) {
  const category = await prisma.skillCategory.findFirst({ where: { id, classroomId } });
  if (!category) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return category;
}

export async function findTierInClassroom(id: number, classroomId: number) {
  const tier = await prisma.skillTier.findFirst({ where: { id, classroomId } });
  if (!tier) throw new ApiError(404, "TIER_NOT_FOUND", "Tier not found");
  return tier;
}

/** A 分類 / 等級 the client points a skill at: same 舞種, else 400 (the skill exists, the reference is bad). */
async function requirePlace(db: Tx, scope: Scope, categoryId: number | null, tierId: number | null) {
  const [category, tier] = await Promise.all([
    categoryId === null
      ? null
      : db.skillCategory.findFirst({ where: { id: categoryId, ...scope }, select: { id: true, name: true } }),
    tierId === null ? null : db.skillTier.findFirst({ where: { id: tierId, ...scope }, select: { id: true } }),
  ]);
  if (categoryId !== null && !category) throw badRequest("CATEGORY_NOT_FOUND", "Category not in this tree");
  if (tierId !== null && !tier) throw badRequest("TIER_NOT_FOUND", "Tier not in this tree");
  return { category };
}

/** 「二轉 · Lv2」— how a tier reads in the 修改紀錄, by its current position. */
async function tierWords(db: Tx, scope: Scope) {
  const tiers = sorted(await db.skillTier.findMany({ where: scope, select: tierSelect }));
  return new Map(tiers.map((t, i) => [t.id, t.label ? `${tierName(i)} · ${t.label}` : tierName(i)]));
}

async function categoryWords(db: Tx, scope: Scope) {
  const categories = await db.skillCategory.findMany({ where: scope, select: { id: true, name: true } });
  return new Map(categories.map((c) => [c.id, c.name]));
}

function logChange(
  db: Tx,
  skill: { id: number; name: string },
  kind: SkillChangeKind,
  actorId: number,
  fromValue: string | null = null,
  toValue: string | null = null
) {
  return db.skillChange.create({
    data: { skillId: skill.id, skillName: skill.name, kind, fromValue, toValue, actorId },
  });
}

async function nextSkillOrder(db: Tx, scope: Scope) {
  const last = await db.skill.aggregate({ where: scope, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}

/** Names already taken by a live skill of this 舞種 (on the tree or in 待定區). */
async function takenNames(db: Tx, scope: Scope, where: Prisma.SkillWhereInput = {}) {
  const live = await db.skill.findMany({ where: { ...scope, archivedAt: null, ...where }, select: { name: true } });
  return new Set(live.map((s) => nameKey(s.name)));
}

// ---------------------------------------------------------------------------
// Structure

export async function createTree(scope: Scope, template: "default" | "blank") {
  return prisma.$transaction(async (tx) => {
    if (await tx.skillCategory.count({ where: scope })) {
      throw new ApiError(409, "TREE_EXISTS", "This dance style already has a skill tree");
    }
    const categories = template === "default" ? DEFAULT_CATEGORIES : [{ name: "新分類", color: unusedColor([]), icon: "star" }];
    const tiers = template === "default" ? DEFAULT_TIERS : [""];
    await tx.skillCategory.createMany({ data: categories.map((c, i) => ({ ...scope, ...c, sortOrder: i })) });
    await tx.skillTier.createMany({ data: tiers.map((label, i) => ({ ...scope, label, sortOrder: i })) });
  });
}

export async function createCategory(scope: Scope, data: { name: string; color: string; icon: string }) {
  if (!(await prisma.skillCategory.count({ where: scope }))) {
    throw badRequest("TREE_MISSING", "Create the tree first");
  }
  const last = await prisma.skillCategory.aggregate({ where: scope, _max: { sortOrder: true } });
  return prisma.skillCategory.create({
    data: { ...scope, ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    select: categorySelect,
  });
}

export async function createTier(scope: Scope, label: string) {
  const count = await prisma.skillTier.count({ where: scope });
  if (!count) throw badRequest("TREE_MISSING", "Create the tree first");
  if (count >= MAX_TIERS) throw badRequest("TOO_MANY_TIERS", `At most ${MAX_TIERS} tiers`);
  const last = await prisma.skillTier.aggregate({ where: scope, _max: { sortOrder: true } });
  return prisma.skillTier.create({
    data: { ...scope, label, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    select: tierSelect,
  });
}

/** Swap a 分類 or 等級 with its neighbour; at either end nothing happens. */
export async function moveStructure(kind: "category" | "tier", id: number, scope: Scope, dir: -1 | 1) {
  const model = kind === "category" ? prisma.skillCategory : prisma.skillTier;
  const rows = await (model as typeof prisma.skillTier).findMany({ where: scope, select: { id: true, sortOrder: true } });
  const next = reorder(rows, id, dir);
  if (!next) return;
  await prisma.$transaction(
    next.map((row) => (model as typeof prisma.skillTier).update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } }))
  );
}

/**
 * Delete a 分類. Its skills move to `moveTo` (logged as 換分類), or — `null` —
 * are archived and drop their 分類, so a later 還原 sends them to 待定區.
 * The last 分類 can't go.
 */
export async function deleteCategory(id: number, scope: Scope, moveTo: number | null, actorId: number) {
  await prisma.$transaction(async (tx) => {
    if ((await tx.skillCategory.count({ where: scope })) <= 1) {
      throw badRequest("LAST_CATEGORY", "A tree keeps at least one category");
    }
    if (moveTo === id) throw badRequest("CATEGORY_NOT_FOUND", "Move the skills to another category");
    const { category: target } = await requirePlace(tx, scope, moveTo, null);
    const from = await tx.skillCategory.findUniqueOrThrow({ where: { id } });
    const skills = await tx.skill.findMany({ where: { categoryId: id }, select: { id: true, name: true, archivedAt: true } });

    for (const skill of skills) {
      if (target) {
        await tx.skill.update({ where: { id: skill.id }, data: { categoryId: target.id } });
        await logChange(tx, skill, "move_category", actorId, from.name, target.name);
      } else {
        await tx.skill.update({
          where: { id: skill.id },
          data: { categoryId: null, archivedAt: skill.archivedAt ?? new Date() },
        });
        if (!skill.archivedAt) await logChange(tx, skill, "archive", actorId, from.name, null);
      }
    }
    await tx.skillCategory.delete({ where: { id } });
  });
}

/**
 * Delete a 等級. Skills move to `moveTo`, or are archived (null). Drafts only
 * lose the tier. The rest renumber, so 三轉 becomes 二轉. The last 等級 can't go.
 */
export async function deleteTier(id: number, scope: Scope, moveTo: number | null, actorId: number) {
  await prisma.$transaction(async (tx) => {
    if ((await tx.skillTier.count({ where: scope })) <= 1) {
      throw badRequest("LAST_TIER", "A tree keeps at least one tier");
    }
    if (moveTo === id) throw badRequest("TIER_NOT_FOUND", "Move the skills to another tier");
    await requirePlace(tx, scope, null, moveTo);
    const words = await tierWords(tx, scope);
    const skills = await tx.skill.findMany({
      where: { tierId: id },
      select: { id: true, name: true, archivedAt: true, categoryId: true },
    });

    for (const skill of skills) {
      const draft = skill.categoryId === null;
      if (moveTo !== null) {
        await tx.skill.update({ where: { id: skill.id }, data: { tierId: moveTo } });
        if (!draft) await logChange(tx, skill, "move_tier", actorId, words.get(id), words.get(moveTo));
      } else if (draft) {
        await tx.skill.update({ where: { id: skill.id }, data: { tierId: null } });
      } else {
        await tx.skill.update({
          where: { id: skill.id },
          data: { tierId: null, archivedAt: skill.archivedAt ?? new Date() },
        });
        if (!skill.archivedAt) await logChange(tx, skill, "archive", actorId, words.get(id), null);
      }
    }
    await tx.skillTier.delete({ where: { id } });
    const rest = sorted(await tx.skillTier.findMany({ where: scope, select: { id: true, sortOrder: true } }));
    await Promise.all(rest.map((t, i) => tx.skillTier.update({ where: { id: t.id }, data: { sortOrder: i } })));
  });
}

// ---------------------------------------------------------------------------
// Skills

/** A new skill: with a 分類 it goes on the tree (等級 required), without one into 待定區. */
export async function createSkill(
  scope: Scope,
  input: { name: string; fullName: string; description: string; categoryId?: number; tierId?: number },
  actorId: number
) {
  return prisma.$transaction(async (tx) => {
    const categoryId = input.categoryId ?? null;
    const tierId = input.tierId ?? null;
    if (categoryId !== null && tierId === null) throw badRequest("TIER_REQUIRED", "A skill on the tree needs a tier");
    await requirePlace(tx, scope, categoryId, tierId);
    if ((await takenNames(tx, scope)).has(nameKey(input.name))) {
      throw new ApiError(409, "SKILL_NAME_TAKEN", "A skill with this name already exists");
    }
    const skill = await tx.skill.create({
      data: {
        ...scope,
        name: input.name,
        fullName: input.fullName,
        description: input.description,
        categoryId,
        tierId,
        createdById: actorId,
        sortOrder: await nextSkillOrder(tx, scope),
      },
      select: skillSelect,
    });
    await logChange(tx, skill, "add", actorId);
    return skill;
  });
}

/** 待定區: one name per pasted line. Names already in use (tree or 待定區) are skipped and reported. */
export async function addDrafts(scope: Scope, text: string, actorId: number) {
  const names = draftNames(text);
  if (names.length === 0) throw badRequest("NO_NAMES", "Nothing to add");
  if (names.length > MAX_DRAFT_PASTE) {
    throw badRequest("TOO_MANY_DRAFTS", `At most ${MAX_DRAFT_PASTE} names at once`);
  }
  return prisma.$transaction(async (tx) => {
    const taken = await takenNames(tx, scope);
    const fresh = names.filter((n) => !taken.has(nameKey(n)));
    let order = await nextSkillOrder(tx, scope);
    const added: Prisma.SkillGetPayload<{ select: typeof skillSelect }>[] = [];
    for (const name of fresh) {
      const skill = await tx.skill.create({
        data: { ...scope, name, createdById: actorId, sortOrder: order++ },
        select: skillSelect,
      });
      await logChange(tx, skill, "add", actorId);
      added.push(skill);
    }
    return { added, skipped: names.filter((n) => taken.has(nameKey(n))) };
  });
}

/** Put 待定 cards on the tree. A card whose name the tree already has is skipped and reported. */
export async function placeDrafts(scope: Scope, ids: number[], categoryId: number, tierId: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const { category } = await requirePlace(tx, scope, categoryId, tierId);
    const words = await tierWords(tx, scope);
    const drafts = await tx.skill.findMany({
      where: { ...scope, id: { in: ids }, categoryId: null, archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (drafts.length !== new Set(ids).size) throw new ApiError(404, "SKILL_NOT_FOUND", "Draft not found");
    const onTree = await takenNames(tx, scope, { categoryId: { not: null } });
    const placed: number[] = [];
    const skipped: string[] = [];
    for (const draft of drafts) {
      if (onTree.has(nameKey(draft.name))) {
        skipped.push(draft.name);
        continue;
      }
      onTree.add(nameKey(draft.name));
      await tx.skill.update({ where: { id: draft.id }, data: { categoryId, tierId } });
      await logChange(tx, draft, "place", actorId, null, `${category!.name} · ${words.get(tierId)}`);
      placed.push(draft.id);
    }
    return { placed, skipped };
  });
}

/**
 * Edit a skill and log each change in the same transaction. Giving a 待定
 * card a 分類 places it (等級 required). Archived skills are read-only until 還原.
 */
export async function patchSkill(
  id: number,
  classroomId: number,
  input: { name?: string; fullName?: string; description?: string; categoryId?: number; tierId?: number | null },
  actorId: number
) {
  return prisma.$transaction(async (tx) => {
    const skill = await tx.skill.findFirst({ where: { id, classroomId } });
    if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
    if (skill.archivedAt) throw badRequest("SKILL_ARCHIVED", "Restore the skill first");
    const scope = { classroomId, danceStyleId: skill.danceStyleId };
    const draft = skill.categoryId === null;

    const categoryId = input.categoryId ?? skill.categoryId;
    const tierId = input.tierId !== undefined ? input.tierId : skill.tierId;
    if (categoryId !== null && tierId === null) throw badRequest("TIER_REQUIRED", "A skill on the tree needs a tier");
    await requirePlace(tx, scope, categoryId, tierId);

    const name = input.name ?? skill.name;
    if (nameKey(name) !== nameKey(skill.name)) {
      const taken = await takenNames(tx, scope, { id: { not: id } });
      if (taken.has(nameKey(name))) throw new ApiError(409, "SKILL_NAME_TAKEN", "A skill with this name already exists");
    }

    const updated = await tx.skill.update({
      where: { id },
      data: {
        name,
        fullName: input.fullName ?? skill.fullName,
        description: input.description ?? skill.description,
        categoryId,
        tierId,
      },
      select: skillSelect,
    });

    const after = { id, name };
    if (name !== skill.name) await logChange(tx, after, "rename", actorId, skill.name, name);
    if (
      (input.fullName !== undefined && input.fullName !== skill.fullName) ||
      (input.description !== undefined && input.description !== skill.description)
    ) {
      await logChange(tx, after, "describe", actorId);
    }
    if (categoryId !== skill.categoryId || tierId !== skill.tierId) {
      const [categories, tiers] = await Promise.all([categoryWords(tx, scope), tierWords(tx, scope)]);
      if (draft) {
        await logChange(tx, after, "place", actorId, null, `${categories.get(categoryId!)} · ${tiers.get(tierId!)}`);
      } else {
        if (categoryId !== skill.categoryId) {
          await logChange(tx, after, "move_category", actorId, categories.get(skill.categoryId!), categories.get(categoryId!));
        }
        if (tierId !== skill.tierId) {
          await logChange(tx, after, "move_tier", actorId, tiers.get(skill.tierId!), tiers.get(tierId!));
        }
      }
    }
    return updated;
  });
}

/** 從樹上移除: a skill on the tree is archived; a 待定 card is deleted with its comments. */
export async function removeSkill(id: number, classroomId: number, actorId: number) {
  const skill = await findSkillInClassroom(id, classroomId);
  if (skill.categoryId === null && !skill.archivedAt) {
    await prisma.skill.delete({ where: { id } });
    return { deleted: true };
  }
  if (skill.archivedAt) return { deleted: false };
  await prisma.$transaction(async (tx) => {
    await tx.skill.update({ where: { id }, data: { archivedAt: new Date() } });
    await logChange(tx, skill, "archive", actorId);
  });
  return { deleted: false };
}

/**
 * 還原: back where it was. If its 分類 or 等級 has since been deleted it lands
 * in 待定區 instead. Refused when a live skill took its name meanwhile.
 */
export async function restoreSkill(id: number, classroomId: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    const skill = await tx.skill.findFirst({ where: { id, classroomId } });
    if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Skill not found");
    if (!skill.archivedAt) return;
    const scope = { classroomId, danceStyleId: skill.danceStyleId };
    if ((await takenNames(tx, scope)).has(nameKey(skill.name))) {
      throw new ApiError(409, "SKILL_NAME_TAKEN", "A skill with this name already exists");
    }
    const placed = skill.categoryId !== null && skill.tierId !== null;
    await tx.skill.update({
      where: { id },
      data: { archivedAt: null, ...(placed ? {} : { categoryId: null }) },
    });
    await logChange(tx, skill, "restore", actorId, null, placed ? null : "待定區");
  });
}

export async function skillHistory(id: number, classroomId: number) {
  await findSkillInClassroom(id, classroomId);
  return prisma.skillChange.findMany({
    where: { skillId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      kind: true,
      skillName: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });
}
