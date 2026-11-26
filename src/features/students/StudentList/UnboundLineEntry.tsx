"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useGetLineInvitesQuery } from "@/store/slices/students";

/** 「未綁 LINE」篩選開著時，名單底部的「逐一複製 LINE 邀請」入口，連到邀請清單。全部綁好時不顯示。 */
const UnboundLineEntry = ({ className = "" }: { className?: string }) => {
  const { data } = useGetLineInvitesQuery();
  const count = data?.students.length ?? 0;
  if (count === 0) return null;

  return (
    <Link
      href="/students/line-invites"
      className={`flex min-h-11 w-full items-center gap-2 text-sm text-ink-3 hover:text-ink ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      逐一複製 LINE 綁定邀請（{count} 位）
      <ChevronRight className="w-4 h-4 ml-auto" />
    </Link>
  );
};

export default UnboundLineEntry;
