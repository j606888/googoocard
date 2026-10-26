"use client"

import * as React from "react"
import { fieldControlClass } from "@/components/Field"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({ date, setDate }: { date: Date | undefined, setDate: (date: Date | undefined) => void }) {
  const [open, setOpen] = React.useState(false)
  const today = new Date()
  const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())

  return (
    <div className="flex flex-col gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id="date"
            className={cn(fieldControlClass(), "h-12 w-36 text-left cursor-pointer", !date && "text-neutral-400")}
          >
            {date ? date.toLocaleDateString("zh-TW") : "選擇日期"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            fromYear={today.getFullYear() - 1}
            toDate={nextYear}
            toYear={today.getFullYear() + 1}
            onSelect={(date) => {
              setDate(date)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
