"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useGetLineInvitesQuery } from "@/store/slices/students";

/** 名單底部「未綁定 LINE N 位」入口，連到邀請清單。全部綁好時不顯示。 */
const UnboundLineEntry = ({ className = "" }: { className?: string }) => {
  const { data } = useGetLineInvitesQuery();
  const count = data?.students.length ?? 0;
  if (count === 0) return null;

  return (
    <Link
      href="/students/line-invites"
      className={`w-full flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      未綁定 LINE {count} 位
      <ChevronRight className="w-4 h-4 ml-auto" />
    </Link>
  );
};

export default UnboundLineEntry;
