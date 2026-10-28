"use client";

import { useParams } from "next/navigation";
import SkillTreeView from "@/features/curriculum/SkillTreeView";

export default function SkillTreePage() {
  const { danceStyleId } = useParams<{ danceStyleId: string }>();
  return <SkillTreeView key={danceStyleId} danceStyleId={Number(danceStyleId)} />;
}
