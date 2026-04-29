import type { Seat } from "../lib/types";

const STATUS_COLORS: Record<string, { light: string; dark: string }> = {
  available: {
    light: "bg-green-400 hover:bg-green-500",
    dark: "bg-green-600 hover:bg-green-500",
  },
  waiting: {
    light: "bg-yellow-400 hover:bg-yellow-500",
    dark: "bg-yellow-500 hover:bg-yellow-400",
  },
  guiding: {
    light: "bg-orange-400 hover:bg-orange-500",
    dark: "bg-orange-500 hover:bg-orange-400",
  },
  seated: {
    light: "bg-gray-400 hover:bg-gray-500",
    dark: "bg-gray-600 hover:bg-gray-500",
  },
};

interface Props {
  seat: Seat;
  onTap: (seat: Seat) => void;
  dark?: boolean;
}

export function SeatCell({ seat, onTap, dark = false }: Props) {
  if (seat.type === "equipment") {
    return (
      <div
        className={`w-12 h-10 rounded flex items-center justify-center text-xs select-none ${
          dark
            ? "bg-slate-700 text-slate-400"
            : "bg-slate-800 text-slate-400"
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
      className={`w-12 h-10 rounded flex items-center justify-center text-xs font-medium select-none transition-colors ${colorClass} ${
        dark ? "text-gray-100" : ""
      } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
    >
      {seat.id}
    </button>
  );
}
