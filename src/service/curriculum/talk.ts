import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/apiError";
import { mentionsIn, talkMarks, isOpen, type Reaction, type Talk, type TalkComment } from "@/domains/curriculum/talk";
import { findSkillInClassroom } from "./skillTree";

type Tx = Prisma.TransactionClient;

const commentSelect = {
  id: true,
  skillId: true,
  parentId: true,
  authorId: true,
  text: true,
  createdAt: true,
  editedAt: true,
  conclusionAt: true,
  author: { select: { name: true } },
  conclusionBy: { select: { name: true } },
  reactions: { select: { kind: true, user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
} as const;

type CommentRow = Prisma.SkillCommentGetPayload<{ select: typeof commentSelect }>;

function toTalkComment(row: CommentRow): TalkComment {
  const byKind = new Map<string, { id: number; name: string }[]>();
  for (const r of row.reactions) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.user]);
  return {
    id: row.id,
    skillId: row.skillId,
    parentId: row.parentId,
    authorId: row.authorId,
    author: row.author?.name ?? "已刪除的使用者",
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    conclusion: row.conclusionAt
      ? { by: row.conclusionBy?.name ?? "", at: row.conclusionAt.toISOString() }
      : null,
    reactions: [...byKind].map(([kind, people]) => ({ kind: kind as Reaction, people })),
  };
}

/** The classroom's members, for @ — anyone who can open the classroom can be named. */
export async function classroomPeople(db: Tx | typeof prisma, classroomId: number) {
  const members = await db.membership.findMany({
    where: { classroomId },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });
  return members.map((m) => m.user);
}

/** What you've read and where you've been @-ed but haven't looked yet, for these skills. */
async function readState(userId: number, skillIds: number[]) {
  const [reads, mentions] = await Promise.all([
    prisma.skillTalkRead.findMany({ where: { userId, skillId: { in: skillIds } }, select: { skillId: true, readAt: true } }),
    prisma.skillCommentMention.findMany({
      where: { userId, seenAt: null, comment: { skillId: { in: skillIds } } },
      select: { comment: { select: { skillId: true } } },
    }),
  ]);
  return {
    readAt: Object.fromEntries(reads.map((r) => [r.skillId, r.readAt.toISOString()])) as Record<number, string>,
    mentioned: [...new Set(mentions.map((m) => m.comment.skillId))],
  };
}

/** Every comment on one 舞種's skills (tree, 待定區 and archived), with your read state. */
export async function loadTalk(classroomId: number, danceStyleId: number, userId: number): Promise<Talk> {
  const skillIds = (
    await prisma.skill.findMany({ where: { classroomId, danceStyleId }, select: { id: true } })
  ).map((s) => s.id);
  const [rows, state] = await Promise.all([
    prisma.skillComment.findMany({
      where: { skillId: { in: skillIds } },
      select: commentSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    readState(userId, skillIds),
  ]);
  return { comments: rows.map(toTalkComment), ...state };
}

/**
 * The 技能樹 entry page: per live 舞種, whether it has a tree, how many skills,
 * how many 討論中, how many with news for you.
 */
export async function curriculumStyles(classroomId: number, userId: number) {
  const [styles, categories, skills] = await Promise.all([
    prisma.danceStyle.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, name: true, color: true, hasLevels: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.skillCategory.groupBy({ by: ["danceStyleId"], where: { classroomId }, _count: true }),
    prisma.skill.findMany({
      where: { classroomId, archivedAt: null },
      select: { id: true, danceStyleId: true, categoryId: true },
    }),
  ]);
  const skillIds = skills.map((s) => s.id);
  const [comments, state] = await Promise.all([
    prisma.skillComment.findMany({
      where: { skillId: { in: skillIds } },
      select: { id: true, skillId: true, authorId: true, createdAt: true, conclusionAt: true },
    }),
    readState(userId, skillIds),
  ]);
  const marks = talkMarks(
    {
      comments: comments.map((c) => ({
        id: c.id,
        skillId: c.skillId,
        parentId: null,
        authorId: c.authorId,
        author: "",
        text: "",
        createdAt: c.createdAt.toISOString(),
        editedAt: null,
        conclusion: c.conclusionAt ? { by: "", at: "" } : null,
        reactions: [],
      })),
      ...state,
    },
    userId
  );
  const withTree = new Set(categories.map((c) => c.danceStyleId));
  return styles.map((danceStyle) => {
    const mine = skills.filter((s) => s.danceStyleId === danceStyle.id);
    return {
      danceStyle,
      hasTree: withTree.has(danceStyle.id),
      skillCount: mine.filter((s) => s.categoryId !== null).length,
      draftCount: mine.filter((s) => s.categoryId === null).length,
      openCount: mine.filter((s) => isOpen(marks.get(s.id))).length,
      freshCount: mine.filter((s) => marks.get(s.id)?.fresh).length,
    };
  });
}

async function findCommentInClassroom(id: number, classroomId: number) {
  const comment = await prisma.skillComment.findFirst({
    where: { id, skill: { classroomId } },
    select: { id: true, skillId: true, authorId: true, parentId: true },
  });
  if (!comment) throw new ApiError(404, "COMMENT_NOT_FOUND", "Comment not found");
  return comment;
}

async function recordMentions(tx: Tx, classroomId: number, commentId: number, text: string, authorId: number) {
  const people = await classroomPeople(tx, classroomId);
  const ids = mentionsIn(text, people).filter((id) => id !== authorId);
  if (ids.length) {
    await tx.skillCommentMention.createMany({
      data: ids.map((userId) => ({ commentId, userId })),
      skipDuplicates: true,
    });
  }
}

async function markReadIn(tx: Tx, skillId: number, userId: number) {
  const now = new Date();
  await tx.skillTalkRead.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, readAt: now },
    update: { readAt: now },
  });
  await tx.skillCommentMention.updateMany({
    where: { userId, seenAt: null, comment: { skillId } },
    data: { seenAt: now },
  });
}

/**
 * Leave a comment. A reply to a reply joins the same thread (one level). Your
 * own comment counts as read, and @名字 in it records a mention.
 */
export async function postComment(
  skillId: number,
  classroomId: number,
  userId: number,
  text: string,
  parentId?: number
) {
  await findSkillInClassroom(skillId, classroomId);
  return prisma.$transaction(async (tx) => {
    let threadId: number | null = null;
    if (parentId !== undefined) {
      const parent = await tx.skillComment.findFirst({ where: { id: parentId, skillId } });
      if (!parent) throw badRequest("COMMENT_NOT_FOUND", "The comment you replied to is gone");
      threadId = parent.parentId ?? parent.id;
    }
    const comment = await tx.skillComment.create({
      data: { skillId, parentId: threadId, authorId: userId, text },
      select: commentSelect,
    });
    await recordMentions(tx, classroomId, comment.id, text, userId);
    await markReadIn(tx, skillId, userId);
    return toTalkComment(comment);
  });
}

/** Only the author edits. Newly @-ed people are added; earlier mentions stay. */
export async function editComment(id: number, classroomId: number, userId: number, text: string) {
  const comment = await findCommentInClassroom(id, classroomId);
  if (comment.authorId !== userId) throw new ApiError(403, "NOT_COMMENT_AUTHOR", "Only the author can edit");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.skillComment.update({
      where: { id },
      data: { text, editedAt: new Date() },
      select: commentSelect,
    });
    await recordMentions(tx, classroomId, id, text, userId);
    return toTalkComment(updated);
  });
}

/** The author, or someone who manages members (管理員). Replies go with it. */
export async function deleteComment(id: number, classroomId: number, userId: number, canModerate: boolean) {
  const comment = await findCommentInClassroom(id, classroomId);
  if (comment.authorId !== userId && !canModerate) {
    throw new ApiError(403, "NOT_COMMENT_AUTHOR", "Only the author or an admin can delete");
  }
  await prisma.skillComment.delete({ where: { id } });
}

/** One reaction per person per comment; the same one again takes it back. */
export async function react(id: number, classroomId: number, userId: number, kind: Reaction) {
  await findCommentInClassroom(id, classroomId);
  const key = { commentId_userId: { commentId: id, userId } };
  const current = await prisma.skillCommentReaction.findUnique({ where: key });
  if (current?.kind === kind) {
    await prisma.skillCommentReaction.delete({ where: key });
    return { kind: null };
  }
  await prisma.skillCommentReaction.upsert({
    where: key,
    create: { commentId: id, userId, kind },
    update: { kind, createdAt: new Date() },
  });
  return { kind };
}

/** 標成結論: at most one per skill, so any other is cleared first. */
export async function setConclusion(id: number, classroomId: number, userId: number) {
  const comment = await findCommentInClassroom(id, classroomId);
  await prisma.$transaction([
    prisma.skillComment.updateMany({
      where: { skillId: comment.skillId, conclusionAt: { not: null } },
      data: { conclusionAt: null, conclusionById: null },
    }),
    prisma.skillComment.update({ where: { id }, data: { conclusionAt: new Date(), conclusionById: userId } }),
  ]);
}

export async function clearConclusion(id: number, classroomId: number) {
  await findCommentInClassroom(id, classroomId);
  await prisma.skillComment.update({ where: { id }, data: { conclusionAt: null, conclusionById: null } });
}

/** Opening a skill's 討論: it's read now, and your @s in it are seen. */
export async function markRead(skillId: number, classroomId: number, userId: number) {
  await findSkillInClassroom(skillId, classroomId);
  await prisma.$transaction((tx) => markReadIn(tx, skillId, userId));
}
