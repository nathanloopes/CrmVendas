import { format, isToday, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

const typeColors: Record<string, string> = {
  meeting: "bg-primary",
  call: "bg-amber-500",
  task: "bg-emerald-500",
  other: "bg-muted-foreground",
};

interface DayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayCell({ date, currentMonth, events, onDayClick, onEventClick }: DayCellProps) {
  const sameMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);

  return (
    <div
      className={cn(
        "min-h-[6rem] border-r border-b p-1 cursor-pointer hover:bg-muted/50 transition-colors",
        !sameMonth && "opacity-40 bg-muted/20"
      )}
      onClick={() => onDayClick(date)}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
          today && "bg-primary text-primary-foreground"
        )}
      >
        {format(date, "d")}
      </span>

      <div className="mt-0.5 space-y-0.5">
        {events.slice(0, 3).map((evt) => (
          <button
            key={evt.id}
            className={cn(
              "w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate text-primary-foreground",
              typeColors[evt.event_type] || typeColors.other
            )}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(evt);
            }}
          >
            {evt.title}
          </button>
        ))}
        {events.length > 3 && (
          <span className="text-[10px] text-muted-foreground px-1">+{events.length - 3} mais</span>
        )}
      </div>
    </div>
  );
}
