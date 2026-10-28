import { z } from "zod";
import { DANCE_STYLE_COLORS } from "@/lib/danceStyles";
import {
  CATEGORY_NAME_MAX,
  SKILL_CATEGORY_ICONS,
  SKILL_DESCRIPTION_MAX,
  SKILL_FULL_NAME_MAX,
  SKILL_NAME_MAX,
  TIER_LABEL_MAX,
} from "./skillTree";
import { COMMENT_MAX, REACTION_IDS } from "./talk";

const id = z.number().int().positive();
const trimmed = (max: number) => z.string().trim().max(max);
const name = (max: number) => trimmed(max).min(1, "必填");

export const createTreeSchema = z.object({ template: z.enum(["default", "blank"]) });

export const categorySchema = z.object({
  name: name(CATEGORY_NAME_MAX),
  color: z.enum(DANCE_STYLE_COLORS),
  icon: z.enum(SKILL_CATEGORY_ICONS),
});
export const patchCategorySchema = categorySchema.partial();

export const tierSchema = z.object({ label: trimmed(TIER_LABEL_MAX).default("") });

export const moveSchema = z.object({ dir: z.union([z.literal(-1), z.literal(1)]) });
/** Deleting a 分類／等級: move its skills to `moveTo`, or archive them (null). */
export const deleteStructureSchema = z.object({ moveTo: id.nullable() });

export const createSkillSchema = z.object({
  name: name(SKILL_NAME_MAX),
  fullName: trimmed(SKILL_FULL_NAME_MAX).default(""),
  description: trimmed(SKILL_DESCRIPTION_MAX).default(""),
  /** Omitted → 待定區. */
  categoryId: id.optional(),
  tierId: id.optional(),
});

export const patchSkillSchema = z.object({
  name: name(SKILL_NAME_MAX).optional(),
  fullName: trimmed(SKILL_FULL_NAME_MAX).optional(),
  description: trimmed(SKILL_DESCRIPTION_MAX).optional(),
  categoryId: id.optional(),
  /** A 待定 card may drop its tier (null); a skill on the tree may not. */
  tierId: id.nullable().optional(),
});

export const addDraftsSchema = z.object({ text: z.string().max(20000) });
export const placeDraftsSchema = z.object({ ids: z.array(id).min(1).max(200), categoryId: id, tierId: id });

export const commentSchema = z.object({ text: name(COMMENT_MAX), parentId: id.optional() });
export const editCommentSchema = z.object({ text: name(COMMENT_MAX) });
export const reactionSchema = z.object({ kind: z.enum(REACTION_IDS) });
