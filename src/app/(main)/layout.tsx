import DesktopSidebar from "@/features/DesktopSidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col md:sticky md:top-0 md:h-screen md:border-r md:border-gray-200 bg-white">
        <DesktopSidebar />
      </aside>
      <div className="flex flex-col flex-1 min-w-0">{children}</div>
    </div>
  );
}
