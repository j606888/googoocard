import { useMemo } from "react";
import { useGetMembershipsQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import { useAccess } from "@/hooks/useCan";
import type { Person } from "@/domains/curriculum/talk";

/** Who's talking: me, the classroom's members (for @), and whether I can remove others' comments. */
export type TalkContext = { me: number; people: Person[]; canModerate: boolean; canEdit: boolean };

export function useTalkContext(): TalkContext {
  const { data: me } = useGetMeQuery();
  const { data: memberships } = useGetMembershipsQuery();
  const { can } = useAccess();
  const canModerate = can("members.manage");
  const canEdit = can("curriculum.edit");
  return useMemo(
    () => ({
      me: me?.id ?? 0,
      people: (memberships ?? []).map((m) => ({ id: m.userId, name: m.user.name })),
      canModerate,
      canEdit,
    }),
    [me?.id, memberships, canModerate, canEdit]
  );
}
