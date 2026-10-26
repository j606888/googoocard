import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/prisma";
import { findDanceStyleInClassroom } from "@/lib/authz";
import { resetDb, createClassroom, createDanceStyle } from "../factories";

// The backfill itself was exercised against legacy enum rows while the enum
// still existed (git history: tests/api/dance-style-backfill.test.ts, removed
// with the contract migration). What's left to guard is that the later
// migrations re-ran exactly that tested block.
const MIGRATIONS = path.join(__dirname, "../../prisma/migrations");
const backfillBlockOf = (suffix: string) => {
  const dir = readdirSync(MIGRATIONS).find((d) => d.endsWith(suffix))!;
  const sql = readFileSync(path.join(MIGRATIONS, dir, "migration.sql"), "utf8");
  return sql.split("-- BACKFILL BEGIN")[1].split("-- BACKFILL END")[0];
};

describe("dance style migrations", () => {
  it("re-run and contract migrations carry the expand backfill block verbatim", () => {
    const block = backfillBlockOf("_dance_styles");
    expect(block).toContain("INSERT INTO \"DanceStyle\"");
    expect(backfillBlockOf("_dance_styles_rebackfill")).toBe(block);
    expect(backfillBlockOf("_dance_styles_contract")).toBe(block);
  });

  it("left every lesson and qualification with a style (NOT NULL)", async () => {
    const columns = await prisma.$queryRaw<{ table_name: string; is_nullable: string }[]>`
      SELECT table_name, is_nullable FROM information_schema.columns
      WHERE column_name = 'danceStyleId' AND table_schema = current_schema()
      ORDER BY table_name`;
    expect(columns).toEqual([
      { table_name: "Card", is_nullable: "YES" },
      { table_name: "Lesson", is_nullable: "NO" },
      // 模組：技能樹 — one tree per style
      { table_name: "Skill", is_nullable: "NO" },
      { table_name: "SkillCategory", is_nullable: "NO" },
      { table_name: "SkillTier", is_nullable: "NO" },
      { table_name: "StudentDanceQualification", is_nullable: "NO" },
    ]);
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
