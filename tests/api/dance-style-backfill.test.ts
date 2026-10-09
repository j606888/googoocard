import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/prisma";
import { findDanceStyleInClassroom } from "@/lib/authz";
import type { DanceType } from "@prisma/client";
import {
  resetDb,
  createClassroom,
  createDanceStyle,
  createStudent,
} from "../factories";

// Runs the backfill block of the dance_styles migration against rows written
// the legacy way (enum set, danceStyleId NULL) — the same thing the contract
// migration will do when it re-runs the block.
const MIGRATIONS = path.join(__dirname, "../../prisma/migrations");
const migrationDir = readdirSync(MIGRATIONS).find((d) =>
  d.endsWith("_dance_styles"),
)!;
const sql = readFileSync(
  path.join(MIGRATIONS, migrationDir, "migration.sql"),
  "utf8",
);
const block = sql.split("-- BACKFILL BEGIN")[1].split("-- BACKFILL END")[0];
const statements = block
  .replace(/^\s*--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

async function runBackfill() {
  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
}

// Rows as the old code writes them: enum set, danceStyleId NULL. The shared
// factories write danceStyleId, so these bypass them.
const createLesson = async (
  classroomId: number,
  { danceType, level = 1 }: { danceType: DanceType; level?: number },
) => ({
  lesson: await prisma.lesson.create({
    data: { name: "Lesson", classroomId, danceType, level },
  }),
});
const createCard = (
  classroomId: number,
  {
    isPracticeCard = false,
    danceType = null,
  }: { isPracticeCard?: boolean; danceType?: DanceType | null } = {},
) =>
  prisma.card.create({
    data: {
      name: "Card",
      price: 3000,
      sessions: 6,
      classroomId,
      isPracticeCard,
      danceType,
    },
  });
const createLegacyStudent = async (
  classroomId: number,
  levels: Partial<Record<DanceType, number>>,
) => {
  const student = await createStudent(classroomId);
  await prisma.studentDanceQualification.createMany({
    data: Object.entries(levels).map(([danceType, level]) => ({
      studentId: student.id,
      danceType: danceType as DanceType,
      level: level!,
    })),
  });
  return student;
};

const stylesOf = (classroomId: number) =>
  prisma.danceStyle.findMany({
    where: { classroomId },
    orderBy: { sortOrder: "asc" },
  });

describe("dance style backfill", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    classroomId = (await createClassroom()).id;
  });

  it("creates one style per enum value used by lessons, cards or qualifications", async () => {
    await createLesson(classroomId, { danceType: "SALSA" });
    await createLesson(classroomId, { danceType: "SALSA" });
    await createCard(classroomId, {
      isPracticeCard: true,
      danceType: "KIZOMBA",
    });
    await createCard(classroomId); // general card: no style
    await createLegacyStudent(classroomId, { ZOUK: 1 });
    const other = (
      await createClassroom({ name: "Other", email: "o@test.local" })
    ).id;
    await createLesson(other, { danceType: "BACHATA" });

    await runBackfill();

    const styles = await stylesOf(classroomId);
    expect(
      styles.map((s) => [s.name, s.color, s.sortOrder, s.legacyDanceType]),
    ).toEqual([
      ["Salsa", "orange", 1, "SALSA"],
      ["Zouk", "slate", 2, "ZOUK"],
      ["Kizomba", "purple", 4, "KIZOMBA"],
    ]);
    expect((await stylesOf(other)).map((s) => s.name)).toEqual(["Bachata"]);

    const byType = Object.fromEntries(
      styles.map((s) => [s.legacyDanceType, s.id]),
    );
    const lessons = await prisma.lesson.findMany({ where: { classroomId } });
    expect(lessons.every((l) => l.danceStyleId === byType.SALSA)).toBe(true);
    const cards = await prisma.card.findMany({
      where: { classroomId },
      orderBy: { id: "asc" },
    });
    expect(cards.map((c) => c.danceStyleId)).toEqual([byType.KIZOMBA, null]);
    const quals = await prisma.studentDanceQualification.findMany();
    expect(quals.map((q) => q.danceStyleId)).toEqual([byType.ZOUK]);
  });

  it("turns hasLevels on only where a lesson or qualification is above level 1", async () => {
    await createLesson(classroomId, { danceType: "HUSTLE", level: 2 });
    await createLesson(classroomId, { danceType: "BACHATA" });
    await createLegacyStudent(classroomId, { ZOUK: 3, BACHATA: 1 });

    await runBackfill();

    const styles = await stylesOf(classroomId);
    expect(
      Object.fromEntries(styles.map((s) => [s.name, s.hasLevels])),
    ).toEqual({
      Bachata: false,
      Zouk: true,
      Hustle: true,
    });
  });

  it("is re-runnable: fills new legacy rows without duplicating or resetting styles", async () => {
    await createLesson(classroomId, { danceType: "HUSTLE", level: 2 });
    await runBackfill();
    const [hustle] = await stylesOf(classroomId);

    // The classroom renames and un-levels its style in between runs…
    await prisma.danceStyle.update({
      where: { id: hustle.id },
      data: { name: "Hustle 社交", hasLevels: false },
    });
    // …and old code keeps writing enum-only rows.
    const { lesson: late } = await createLesson(classroomId, {
      danceType: "HUSTLE",
      level: 3,
    });
    await createLesson(classroomId, { danceType: "SALSA" });

    await runBackfill();

    const styles = await stylesOf(classroomId);
    expect(styles.map((s) => [s.name, s.hasLevels])).toEqual([
      ["Salsa", false],
      ["Hustle 社交", false],
    ]);
    expect(
      (await prisma.lesson.findUnique({ where: { id: late.id } }))!
        .danceStyleId,
    ).toBe(hustle.id);
    expect(await prisma.lesson.count({ where: { danceStyleId: null } })).toBe(
      0,
    );
  });

  it("adopts a hand-made style with the enum's name instead of colliding with it", async () => {
    const mine = await createDanceStyle(classroomId, {
      name: "Bachata",
      color: "pink",
    });
    await createLesson(classroomId, { danceType: "BACHATA" });

    await runBackfill();

    const styles = await stylesOf(classroomId);
    expect(styles.map((s) => [s.id, s.color, s.legacyDanceType])).toEqual([
      [mine.id, "pink", "BACHATA"],
    ]);
    expect(
      await prisma.lesson.count({ where: { danceStyleId: mine.id } }),
    ).toBe(1);
  });
});

describe("findDanceStyleInClassroom", () => {
  it("returns the style only inside its own classroom", async () => {
    await resetDb();
    const a = (await createClassroom()).id;
    const b = (await createClassroom({ name: "B", email: "b@test.local" })).id;
    const style = await createDanceStyle(a);

    expect((await findDanceStyleInClassroom(style.id, a))?.id).toBe(style.id);
    expect(await findDanceStyleInClassroom(style.id, b)).toBeNull();
    expect(await findDanceStyleInClassroom(NaN, a)).toBeNull();
  });
});

describe("dance style backfill re-run migration", () => {
  it("carries the backfill block verbatim", () => {
    const rerunDir = readdirSync(MIGRATIONS).find((d) => d.endsWith("_dance_styles_rebackfill"))!;
    const rerun = readFileSync(path.join(MIGRATIONS, rerunDir, "migration.sql"), "utf8");
    expect(rerun.split("-- BACKFILL BEGIN")[1].split("-- BACKFILL END")[0]).toBe(block);
  });
});
