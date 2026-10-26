"use client";

import { useParams } from "next/navigation";
import TalkOverview from "@/features/curriculum/TalkOverview";

export default function SkillTalkPage() {
  const { danceStyleId } = useParams<{ danceStyleId: string }>();
  return <TalkOverview key={danceStyleId} danceStyleId={Number(danceStyleId)} />;
}
