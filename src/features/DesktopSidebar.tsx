"use client";

import SidebarContent from "./SidebarContent";

const DesktopSidebar = () => {
  return (
    <div className="flex flex-col h-full px-4 py-6 overflow-y-auto">
      <SidebarContent />
    </div>
  );
};

export default DesktopSidebar;
