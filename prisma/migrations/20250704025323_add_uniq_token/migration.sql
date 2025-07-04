/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `InviteToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");
