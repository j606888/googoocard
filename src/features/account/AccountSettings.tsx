import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import Drawer from "@/components/Drawer";
import { Switch } from "@/components/ui/switch";
import {
  type TodoType,
  useDeleteAccountMutation,
  useGetMeQuery,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "@/store/slices/me";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";

const NOTIFICATION_TYPES: { type: TodoType; label: string; hint: string }[] = [
  { type: "UNPAID_CARD", label: "待確認收款", hint: "學生在 LINE 自助購買課卡時" },
  { type: "NEEDS_RENEWAL", label: "需續約", hint: "學生的課卡剛用完時" },
  { type: "UNBOUND_ATTENDANCE", label: "出席沒有課卡", hint: "學生自助簽到但沒有可用的課卡時" },
];

// Typed, not just clicked: the account can't be brought back.
const CONFIRM_TEXT = "我確認要刪除";

const AccountSettings = () => {
  const { data: me } = useGetMeQuery();
  const { data: classrooms } = useGetClassroomsQuery();
  const currentClassroom = classrooms?.classrooms.find(
    (c) => c.id === classrooms.currentClassroomId
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-4">
      <h2 className="text-2xl font-semibold">帳號</h2>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold">基本資料</h3>
        <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-2 text-sm">
          <dt className="text-neutral-500">名稱</dt>
          <dd>{me?.name}</dd>
          <dt className="text-neutral-500">Email</dt>
          <dd className="break-all">{me?.email}</dd>
        </dl>
      </section>

      <NotificationSettings classroomName={currentClassroom?.name} />

      <DeleteAccount />

      <nav className="flex justify-center gap-4 text-sm text-neutral-500">
        <Link href="/privacy">隱私權政策</Link>
        <Link href="/terms">服務條款</Link>
      </nav>
    </div>
  );
};

const NotificationSettings = ({ classroomName }: { classroomName?: string }) => {
  const { data: preferences } = useGetNotificationPreferencesQuery();
  const [updatePreference] = useUpdateNotificationPreferenceMutation();

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold">通知</h3>
      <p className="mt-1 text-sm text-neutral-500">
        {classroomName ? `「${classroomName}」` : "這間教室"}
        有事情需要處理時，推播到已安裝 App 的手機。每間教室分開設定。
      </p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {NOTIFICATION_TYPES.map(({ type, label, hint }) => (
          <li key={type} className="flex items-center justify-between gap-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-neutral-500">{hint}</span>
            </div>
            <Switch
              aria-label={label}
              checked={preferences?.[type] ?? true}
              disabled={!preferences}
              onCheckedChange={(enabled) => updatePreference({ type, enabled })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

type OwnedClassroom = { id: number; name: string };

const DeleteAccount = () => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [ownedClassrooms, setOwnedClassrooms] = useState<OwnedClassroom[]>([]);
  const [deleteAccount, { isLoading }] = useDeleteAccountMutation();

  const close = () => {
    setOpen(false);
    setConfirmText("");
    setError("");
    setOwnedClassrooms([]);
  };

  const handleSubmit = async () => {
    setError("");
    setOwnedClassrooms([]);
    try {
      await deleteAccount().unwrap();
      // Hard navigation drops the RTK Query cache along with the session.
      window.location.href = "/login";
    } catch (e) {
      const data = (e as { data?: { code?: string; classrooms?: OwnedClassroom[] } }).data;
      if (data?.code === "OWNS_CLASSROOMS") {
        setOwnedClassrooms(data.classrooms ?? []);
      } else {
        setError("刪除失敗，請稍後再試。");
      }
    }
  };

  return (
    <>
      <section className="rounded-xl border border-danger-200 bg-danger-50 p-4">
        <div className="flex items-center gap-2 text-danger-700">
          <AlertTriangle className="h-4 w-4" />
          <h3 className="font-semibold">刪除帳號</h3>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          刪除後無法復原，你會被移出所有教室。如果你是教室擁有者，要先把教室轉給其他成員或刪除教室。
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full cursor-pointer rounded-lg border border-danger-500 py-2 font-semibold text-danger-600 hover:bg-danger-100"
        >
          刪除帳號
        </button>
      </section>

      <Drawer
        title="刪除帳號"
        open={open}
        onClose={close}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        variant="danger"
        submitText="刪除"
        disabled={confirmText.trim() !== CONFIRM_TEXT}
      >
        <p className="mb-3 text-sm text-neutral-600">
          你的名稱、Email 與 LINE 綁定都會清除，所有教室都會把你移出，之後無法再用這個帳號登入。
          教室裡的學生、課卡與收入紀錄不受影響。
        </p>
        <label className="mb-2 block text-sm font-medium">
          請輸入 <span className="font-semibold">{CONFIRM_TEXT}</span> 以確認
        </label>
        <input
          className="mb-2 w-full rounded bg-neutral-100 p-2"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_TEXT}
        />
        {ownedClassrooms.length > 0 && (
          <div className="mt-2 rounded-lg bg-warning-100 p-3 text-sm text-warning-900">
            <p>你還是這些教室的擁有者，請先到「團隊」把教室轉給其他成員，或刪除教室：</p>
            <ul className="mt-1 list-disc pl-5">
              {ownedClassrooms.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
            <Link href="/teams" className="mt-2 inline-block font-semibold underline">
              前往團隊
            </Link>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      </Drawer>
    </>
  );
};

export default AccountSettings;
