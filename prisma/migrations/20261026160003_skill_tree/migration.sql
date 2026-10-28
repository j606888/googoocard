-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "danceStyleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillTier" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "danceStyleId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "classroomId" INTEGER NOT NULL,
    "danceStyleId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "tierId" INTEGER,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillChange" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "skillName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillComment" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "authorId" INTEGER,
    "text" TEXT NOT NULL,
    "conclusionAt" TIMESTAMP(3),
    "conclusionById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "SkillComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCommentReaction" (
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillCommentReaction_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "SkillCommentMention" (
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "SkillCommentMention_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "SkillTalkRead" (
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillTalkRead_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateIndex
CREATE INDEX "SkillCategory_classroomId_danceStyleId_idx" ON "SkillCategory"("classroomId", "danceStyleId");

-- CreateIndex
CREATE INDEX "SkillCategory_danceStyleId_idx" ON "SkillCategory"("danceStyleId");

-- CreateIndex
CREATE INDEX "SkillTier_classroomId_danceStyleId_idx" ON "SkillTier"("classroomId", "danceStyleId");

-- CreateIndex
CREATE INDEX "SkillTier_danceStyleId_idx" ON "SkillTier"("danceStyleId");

-- CreateIndex
CREATE INDEX "Skill_classroomId_danceStyleId_idx" ON "Skill"("classroomId", "danceStyleId");

-- CreateIndex
CREATE INDEX "Skill_danceStyleId_idx" ON "Skill"("danceStyleId");

-- CreateIndex
CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");

-- CreateIndex
CREATE INDEX "Skill_tierId_idx" ON "Skill"("tierId");

-- CreateIndex
CREATE INDEX "SkillChange_skillId_createdAt_idx" ON "SkillChange"("skillId", "createdAt");

-- CreateIndex
CREATE INDEX "SkillComment_skillId_idx" ON "SkillComment"("skillId");

-- CreateIndex
CREATE INDEX "SkillComment_parentId_idx" ON "SkillComment"("parentId");

-- CreateIndex
CREATE INDEX "SkillCommentReaction_userId_idx" ON "SkillCommentReaction"("userId");

-- CreateIndex
CREATE INDEX "SkillCommentMention_userId_idx" ON "SkillCommentMention"("userId");

-- CreateIndex
CREATE INDEX "SkillTalkRead_skillId_idx" ON "SkillTalkRead"("skillId");

-- AddForeignKey
ALTER TABLE "SkillCategory" ADD CONSTRAINT "SkillCategory_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCategory" ADD CONSTRAINT "SkillCategory_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTier" ADD CONSTRAINT "SkillTier_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTier" ADD CONSTRAINT "SkillTier_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_danceStyleId_fkey" FOREIGN KEY ("danceStyleId") REFERENCES "DanceStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SkillCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SkillTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillChange" ADD CONSTRAINT "SkillChange_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillChange" ADD CONSTRAINT "SkillChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillComment" ADD CONSTRAINT "SkillComment_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillComment" ADD CONSTRAINT "SkillComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SkillComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillComment" ADD CONSTRAINT "SkillComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillComment" ADD CONSTRAINT "SkillComment_conclusionById_fkey" FOREIGN KEY ("conclusionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCommentReaction" ADD CONSTRAINT "SkillCommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SkillComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCommentReaction" ADD CONSTRAINT "SkillCommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCommentMention" ADD CONSTRAINT "SkillCommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SkillComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCommentMention" ADD CONSTRAINT "SkillCommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTalkRead" ADD CONSTRAINT "SkillTalkRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTalkRead" ADD CONSTRAINT "SkillTalkRead_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
