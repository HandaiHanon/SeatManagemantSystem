import type { Seat } from "../lib/types";

const STATUS_COLORS: Record<string, { light: string; dark: string }> = {
  available: {
    light: "bg-green-400 hover:bg-green-500 active:bg-green-600",
    dark: "bg-green-600 hover:bg-green-500 active:bg-green-400",
  },
  waiting: {
    light: "bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600",
    dark: "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300",
  },
  guiding: {
    light: "bg-orange-400 hover:bg-orange-500 active:bg-orange-600",
    dark: "bg-orange-500 hover:bg-orange-400 active:bg-orange-300",
  },
  seated: {
    light: "bg-gray-400 hover:bg-gray-500 active:bg-gray-600",
    dark: "bg-gray-600 hover:bg-gray-500 active:bg-gray-400",
  },
};

interface Props {
  seat: Seat;
  onTap: (seat: Seat) => void;
  dark?: boolean;
  compact?: boolean;
}

export function SeatCell({ seat, onTap, dark = false, compact = false }: Props) {
  const size = compact ? "w-8 h-8 text-[9px]" : "w-11 h-11 sm:w-12 sm:h-11 text-[10px] sm:text-xs";

  if (seat.type === "equipment") {
    return (
      <div
        className={`${size} rounded flex items-center justify-center select-none ${
          dark ? "bg-slate-700 text-slate-400" : "bg-slate-800 text-slate-400"
        }`}
      >
        {seat.id}
      </div>
    );
  }

  const colors = STATUS_COLORS[seat.status] || { light: "bg-gray-300", dark: "bg-gray-700" };
  const colorClass = dark ? colors.dark : colors.light;
  const isClickable = seat.status === "waiting" || seat.status === "guiding" || seat.status === "seated";

  return (
    <button
      onClick={() => onTap(seat)}
      disabled={!isClickable}
      className={`${size} rounded flex items-center justify-center font-medium select-none transition-colors ${colorClass} ${
        dark ? "text-gray-100" : ""
      } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
    >
      {seat.id}
    </button>
  );
}
