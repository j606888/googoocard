import DesktopSidebar from "@/features/DesktopSidebar";
import BottomNav from "@/features/nav/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col md:sticky md:top-0 md:h-screen md:border-r md:border-neutral-200 bg-white">
        <DesktopSidebar />
      </aside>
      <div className="flex flex-col flex-1 min-w-0 pb-24 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
