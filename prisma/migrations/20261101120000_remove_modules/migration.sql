-- 移除水庫、技能樹、模組開關、今天的助教，權限回到純角色（2026-11-01）。
-- 只 drop 這些功能自己的表、enum 與 Membership.grants/revokes；核心表不動。

-- DropForeignKey
ALTER TABLE "LessonPeriodAssistant" DROP CONSTRAINT "LessonPeriodAssistant_lessonPeriodId_fkey";

-- DropForeignKey
ALTER TABLE "LessonPeriodAssistant" DROP CONSTRAINT "LessonPeriodAssistant_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ClassroomModule" DROP CONSTRAINT "ClassroomModule_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "ClassroomModule" DROP CONSTRAINT "ClassroomModule_enabledById_fkey";

-- DropForeignKey
ALTER TABLE "SkillCategory" DROP CONSTRAINT "SkillCategory_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "SkillCategory" DROP CONSTRAINT "SkillCategory_danceStyleId_fkey";

-- DropForeignKey
ALTER TABLE "SkillTier" DROP CONSTRAINT "SkillTier_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "SkillTier" DROP CONSTRAINT "SkillTier_danceStyleId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_danceStyleId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_tierId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_createdById_fkey";

-- DropForeignKey
ALTER TABLE "SkillChange" DROP CONSTRAINT "SkillChange_skillId_fkey";

-- DropForeignKey
ALTER TABLE "SkillChange" DROP CONSTRAINT "SkillChange_actorId_fkey";

-- DropForeignKey
ALTER TABLE "SkillComment" DROP CONSTRAINT "SkillComment_skillId_fkey";

-- DropForeignKey
ALTER TABLE "SkillComment" DROP CONSTRAINT "SkillComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SkillComment" DROP CONSTRAINT "SkillComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "SkillComment" DROP CONSTRAINT "SkillComment_conclusionById_fkey";

-- DropForeignKey
ALTER TABLE "SkillCommentReaction" DROP CONSTRAINT "SkillCommentReaction_commentId_fkey";

-- DropForeignKey
ALTER TABLE "SkillCommentReaction" DROP CONSTRAINT "SkillCommentReaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "SkillCommentMention" DROP CONSTRAINT "SkillCommentMention_commentId_fkey";

-- DropForeignKey
ALTER TABLE "SkillCommentMention" DROP CONSTRAINT "SkillCommentMention_userId_fkey";

-- DropForeignKey
ALTER TABLE "SkillTalkRead" DROP CONSTRAINT "SkillTalkRead_userId_fkey";

-- DropForeignKey
ALTER TABLE "SkillTalkRead" DROP CONSTRAINT "SkillTalkRead_skillId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSetting" DROP CONSTRAINT "FinanceSetting_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSetting" DROP CONSTRAINT "FinanceSetting_revenueOwnerUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceOpeningCustody" DROP CONSTRAINT "FinanceOpeningCustody_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceOpeningCustody" DROP CONSTRAINT "FinanceOpeningCustody_userId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRemittance" DROP CONSTRAINT "FinanceRemittance_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRemittance" DROP CONSTRAINT "FinanceRemittance_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRemittance" DROP CONSTRAINT "FinanceRemittance_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_payeeUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_locationId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_createdById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntryRevision" DROP CONSTRAINT "FinanceEntryRevision_entryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntryRevision" DROP CONSTRAINT "FinanceEntryRevision_editedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSettingRevision" DROP CONSTRAINT "FinanceSettingRevision_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSettingRevision" DROP CONSTRAINT "FinanceSettingRevision_editedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceQuestDone" DROP CONSTRAINT "FinanceQuestDone_userId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceQuestDone" DROP CONSTRAINT "FinanceQuestDone_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitRule" DROP CONSTRAINT "FinanceSplitRule_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitRule" DROP CONSTRAINT "FinanceSplitRule_locationId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitRule" DROP CONSTRAINT "FinanceSplitRule_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitRule" DROP CONSTRAINT "FinanceSplitRule_venueTeacherId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitShare" DROP CONSTRAINT "FinanceSplitShare_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSplitShare" DROP CONSTRAINT "FinanceSplitShare_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceLessonSettlement" DROP CONSTRAINT "FinanceLessonSettlement_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceLessonSettlement" DROP CONSTRAINT "FinanceLessonSettlement_lessonPeriodId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceLessonSettlement" DROP CONSTRAINT "FinanceLessonSettlement_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSettlementLine" DROP CONSTRAINT "FinanceSettlementLine_settlementId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSettlementLine" DROP CONSTRAINT "FinanceSettlementLine_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSettlementRevision" DROP CONSTRAINT "FinanceSettlementRevision_settlementId_fkey";

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "grants",
DROP COLUMN "revokes";

-- DropTable
DROP TABLE "LessonPeriodAssistant";

-- DropTable
DROP TABLE "ClassroomModule";

-- DropTable
DROP TABLE "SkillCategory";

-- DropTable
DROP TABLE "SkillTier";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "SkillChange";

-- DropTable
DROP TABLE "SkillComment";

-- DropTable
DROP TABLE "SkillCommentReaction";

-- DropTable
DROP TABLE "SkillCommentMention";

-- DropTable
DROP TABLE "SkillTalkRead";

-- DropTable
DROP TABLE "FinanceSetting";

-- DropTable
DROP TABLE "FinanceOpeningCustody";

-- DropTable
DROP TABLE "FinanceRemittance";

-- DropTable
DROP TABLE "FinanceEntry";

-- DropTable
DROP TABLE "FinanceEntryRevision";

-- DropTable
DROP TABLE "FinanceSettingRevision";

-- DropTable
DROP TABLE "FinanceQuestDone";

-- DropTable
DROP TABLE "FinanceSplitRule";

-- DropTable
DROP TABLE "FinanceSplitShare";

-- DropTable
DROP TABLE "FinanceLessonSettlement";

-- DropTable
DROP TABLE "FinanceSettlementLine";

-- DropTable
DROP TABLE "FinanceSettlementRevision";

-- DropEnum
DROP TYPE "FinanceRemittanceStatus";

-- DropEnum
DROP TYPE "FinanceRuleScope";

-- DropEnum
DROP TYPE "FinanceTeacherPay";

-- DropEnum
DROP TYPE "FinanceFeeMode";

-- DropEnum
DROP TYPE "FinanceVenuePayee";

-- DropEnum
DROP TYPE "FinanceRemainderTo";

-- DropEnum
DROP TYPE "FinanceLineKind";

