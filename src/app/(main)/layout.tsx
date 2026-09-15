import DesktopSidebar from "@/features/DesktopSidebar";
import BottomNav from "@/features/nav/BottomNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-neutral-200 bg-white">
        <DesktopSidebar />
      </aside>
      <div className="flex flex-col flex-1 min-w-0 pb-24 lg:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
