"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { useAssignLocationMutation, type Location } from "@/store/slices/locations";

// 0 = 週日, same as Date#getDay.
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 「套用到既有課程」：把還沒設定分部、而且第一堂在選定星期的課一次標上這個分部。
 * 已經有分部的課不會被改。
 */
const AssignLocationDrawer = ({ location, onClose }: { location: Location; onClose: () => void }) => {
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [assign, { isLoading }] = useAssignLocationMutation();

  const toggle = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const handleSubmit = async () => {
    try {
      const { updated } = await assign({ locationId: location.id, weekdays }).unwrap();
      toast.success(updated ? `已把 ${updated} 堂課標為「${location.name}」` : "沒有符合的課程");
      onClose();
    } catch {
      toast.error("套用失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      open
      title={`套用「${location.name}」到既有課程`}
      subtitle="只改還沒設定分部的課；依第一堂課的星期判斷"
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      disabled={weekdays.length === 0}
      submitText="套用"
    >
      <div className="mb-6 flex flex-col gap-3">
        <p className="font-medium">哪幾天的課在「{location.name}」？</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, day) => {
            const on = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(day)}
                className={`h-11 w-11 rounded-full border text-sm font-medium cursor-pointer ${
                  on
                    ? "border-primary-700 bg-primary-700 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
};

export default AssignLocationDrawer;
