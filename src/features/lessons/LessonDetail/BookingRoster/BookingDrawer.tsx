"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import RoundCheckbox from "@/components/RoundCheckbox";
import { FieldError, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { type BookingRoster, useSetStudentBookingsMutation } from "@/store/slices/lessons";
import { formatDate, cn } from "@/lib/utils";
import StudentPickField, { type Who, whoBody } from "./StudentPickField";

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

type Entry = BookingRoster["students"][number];

/**
 * 登記（`entry` 沒給）或修改一位學生「預計會來」哪幾堂。只列還沒點名的堂——點過名的是紀錄，
 * 不能改。新登記預設勾下一堂；不問付費（付費照舊在點名時處理）。
 */
const BookingDrawer = ({
  lessonId,
  periods,
  entry,
  excludeIds,
  onClose,
}: {
  lessonId: number;
  periods: BookingRoster["periods"];
  entry?: Entry;
  excludeIds: number[];
  onClose: () => void;
}) => {
  const editing = entry !== undefined;
  const open = periods.filter((p) => !p.attendanceTaken);
  const [who, setWho] = useState<Who | null>(
    entry ? { kind: "existing", id: entry.student.id, name: entry.student.name } : null
  );
  const [picked, setPicked] = useState<Set<number>>(() =>
    entry
      ? new Set(periods.filter((p, i) => entry.statuses[i] === "booked").map((p) => p.id))
      : new Set(open.slice(0, 1).map((p) => p.id))
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [setBookings, { isLoading }] = useSetStudentBookingsMutation();

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (periodIds: number[]) => {
    if (!who) {
      setError("請選擇或輸入學員");
      return;
    }
    if (!editing && periodIds.length === 0) {
      setError("至少勾一堂");
      return;
    }
    try {
      await setBookings({ id: lessonId, ...whoBody(who), periodIds, note: note.trim() || null }).unwrap();
      toast.success(periodIds.length === 0 ? "已取消預約" : editing ? "已更新" : `已登記 ${who.name}`);
      onClose();
    } catch {
      toast.error("儲存失敗，請再試一次");
    }
  };

  return (
    <Drawer
      open
      title={editing ? "預計會來" : "登記預計會來"}
      subtitle={editing ? entry.student.name : undefined}
      onClose={onClose}
      onSubmit={() => save([...picked])}
      isLoading={isLoading}
      disabled={!who}
      submitText={editing ? "儲存" : `登記 ${picked.size} 堂`}
      secondaryText="取消"
    >
      <div className="flex flex-col gap-5 pb-4">
        {!editing && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">誰會來</span>
            <StudentPickField
              who={who}
              onChange={(next) => {
                setWho(next);
                setError(null);
              }}
              excludeIds={excludeIds}
              invalid={!!error && !who}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">哪幾堂會來</span>
          {open.length === 0 ? (
            <p className="text-[13px] text-neutral-600">這門課沒有還沒點名的堂了，先去排課。</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
              {open.map((p) => {
                const start = new Date(p.startTime);
                const checked = picked.has(p.id);
                return (
                  <li key={p.id} className="border-b border-neutral-100 last:border-b-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => {
                        toggle(p.id);
                        setError(null);
                      }}
                      className={cn(
                        "flex min-h-12 w-full cursor-pointer items-center gap-3 px-3 text-left",
                        checked ? "bg-primary-50" : "hover:bg-neutral-50"
                      )}
                    >
                      <span className="flex-1 text-[15px] tabular-nums">
                        第 {p.index + 1} 堂 · {formatDate(p.startTime, "M/d")}（{WEEKDAY[start.getDay()]}）
                        {formatDate(p.startTime, " HH:mm")}
                      </span>
                      <RoundCheckbox isChecked={checked} className="size-6 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[13px] text-neutral-600">
            只是讓你知道誰會來，點名時標「預計今天會到」，不會自動勾、也不收錢。
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">備註（選填）</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：先試第一堂，之後考慮整期"
            className={cn(fieldControlClass(), "h-12")}
          />
        </label>
        <FieldError>{error}</FieldError>

        {editing && entry.counts.booked > 0 && (
          <Button type="button" variant="ghost" className="self-start text-danger-700" onClick={() => save([])}>
            取消他還沒上的預約
          </Button>
        )}
      </div>
    </Drawer>
  );
};

export default BookingDrawer;
