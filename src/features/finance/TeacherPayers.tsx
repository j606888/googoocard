"use client";

import { toast } from "sonner";
import Select from "@/components/Select";
import { useGetFinanceTeachersQuery, useSetTeacherPayerMutation } from "@/store/slices/finance";
import { useFinanceMembers } from "./useFinanceForm";

const NONE = 0;

/** 每位老師的鐘點由誰付；連著財務帳號的老師不設也可以。 */
export default function TeacherPayers() {
  const { data } = useGetFinanceTeachersQuery();
  const { options } = useFinanceMembers();
  const [setPayer] = useSetTeacherPayerMutation();
  const teachers = data?.teachers ?? [];
  if (teachers.length === 0) return <p className="text-sm text-neutral-500">還沒有老師</p>;

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {teachers.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{t.name}</span>
          <div className="w-44 shrink-0">
            <Select
              size="sm"
              aria-label={`${t.name} 的付款人`}
              value={t.payerUserId ?? NONE}
              onChange={async (v) => {
                try {
                  await setPayer({ id: t.id, payerUserId: v === NONE ? null : v }).unwrap();
                } catch {
                  toast.error("存不了，請再試一次");
                }
              }}
              options={[{ value: NONE, label: "不指定" }, ...options]}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
