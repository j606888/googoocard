import { useGetClassroomsQuery } from "@/store/slices/classrooms";

/** Whether the current classroom has finance turned on (drives the 財務 nav entry). */
export function useFinanceEnabled(): boolean {
  const { data } = useGetClassroomsQuery();
  return !!data?.classrooms.find((c) => c.id === data.currentClassroomId)?.financeEnabled;
}
