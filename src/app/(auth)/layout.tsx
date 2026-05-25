export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[480px] mx-auto relative min-h-screen overflow-hidden bg-primary-500">
      {children}
    </div>
  );
}
