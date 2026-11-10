import { useGetClassroomsQuery } from "@/store/slices/classrooms";

/**
 * Whether the current classroom has finance turned on (drives the 財務 nav entry).
 * `undefined` while the classroom list is still loading — treat it as "loading", never as "disabled".
 */
export function useFinanceEnabled(): boolean | undefined {
  const { data } = useGetClassroomsQuery();
  if (!data) return undefined;
  return !!data.classrooms.find((c) => c.id === data.currentClassroomId)?.financeEnabled;
}
