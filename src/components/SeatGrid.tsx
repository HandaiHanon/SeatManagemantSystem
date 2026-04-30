import type { Seat } from "../lib/types";
import { SeatCell } from "./SeatCell";

interface Props {
  seats: Seat[];
  onSeatTap: (seat: Seat) => void;
  dark?: boolean;
  compact?: boolean;
  availableClickable?: boolean;
}

export function SeatGrid({
  seats,
  onSeatTap,
  dark = false,
  compact = false,
  availableClickable = false,
}: Props) {
  const rows = [...new Set(seats.map((s) => s.row))].sort();
  const seatsByRow = new Map<string, Seat[]>();
  for (const seat of seats) {
    const arr = seatsByRow.get(seat.row) || [];
    arr.push(seat);
    seatsByRow.set(seat.row, arr);
  }

  const maxCol = Math.max(...seats.map((s) => s.col), 1);

  const textMuted = dark ? "text-gray-500" : "text-gray-500";
  const textLabel = dark ? "text-neutral-400" : "text-gray-600";
  const colSize = compact ? "w-8" : "w-11 sm:w-12";
  const gap = compact ? "gap-0.5" : "gap-1";

  return (
    <div className="space-y-0.5 sm:space-y-1">
      {/* 列番号ヘッダー */}
      <div className={`flex ${gap} ml-6 sm:ml-8`}>
        {Array.from({ length: maxCol }, (_, i) => (
          <div
            key={i}
            className={`${colSize} h-5 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-medium ${textMuted}`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* 座席行 */}
      {rows.map((row) => {
        const rowSeats = (seatsByRow.get(row) || []).sort(
          (a, b) => a.col - b.col
        );
        return (
          <div key={row} className={`flex ${gap} items-center`}>
            <div className={`w-5 sm:w-6 text-center text-xs sm:text-sm font-bold ${textLabel}`}>
              {row}
            </div>
            {rowSeats.map((seat) => (
              <SeatCell
                key={seat.id}
                seat={seat}
                onTap={onSeatTap}
                dark={dark}
                compact={compact}
                availableClickable={availableClickable}
              />
            ))}
          </div>
        );
      })}

      {/* 凡例 */}
      <div className={`flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 justify-center text-xs sm:text-sm ${dark ? "text-neutral-400" : ""}`}>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded inline-block ${dark ? "bg-green-800" : "bg-green-400"}`} /> 空席
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded inline-block ${dark ? "bg-yellow-800" : "bg-yellow-400"}`} /> 待機中
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded inline-block ${dark ? "bg-orange-800" : "bg-orange-400"}`} /> 案内中
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded inline-block ${dark ? "bg-gray-700" : "bg-gray-400"}`} /> 着席済
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded inline-block ${dark ? "bg-slate-900" : "bg-slate-800"}`} /> 機材
        </span>
      </div>
    </div>
  );
}
