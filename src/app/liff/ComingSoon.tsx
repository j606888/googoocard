// Placeholder body for student LIFF features that aren't built yet (上課簽到 /
// 購買課卡). Rendered inside LiffStudentGate, so identity is already verified.
export default function ComingSoon({ title, name }: { title: string; name: string }) {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-3 px-5 py-16 text-center">
      <div className="text-4xl">🚧</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-neutral-500">Hi {name}，此功能即將推出，敬請期待！</p>
    </div>
  );
}
