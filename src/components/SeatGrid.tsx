import type { Seat } from "../lib/types";
import { SeatCell } from "./SeatCell";

interface Props {
  seats: Seat[];
  onSeatTap: (seat: Seat) => void;
  dark?: boolean;
}

export function SeatGrid({ seats, onSeatTap, dark = false }: Props) {
  const rows = [...new Set(seats.map((s) => s.row))].sort();
  const seatsByRow = new Map<string, Seat[]>();
  for (const seat of seats) {
    const arr = seatsByRow.get(seat.row) || [];
    arr.push(seat);
    seatsByRow.set(seat.row, arr);
  }

  const maxCol = Math.max(...seats.map((s) => s.col), 10);

  const textMuted = dark ? "text-gray-400" : "text-gray-500";
  const textLabel = dark ? "text-gray-300" : "text-gray-600";

  return (
    <div className="space-y-1">
      {/* 列番号ヘッダー */}
      <div className="flex gap-1 ml-8">
        {Array.from({ length: maxCol }, (_, i) => (
          <div
            key={i}
            className={`w-12 h-6 flex items-center justify-center text-xs font-medium ${textMuted}`}
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
          <div key={row} className="flex gap-1 items-center">
            <div className={`w-6 text-center text-sm font-bold ${textLabel}`}>
              {row}
            </div>
            {rowSeats.map((seat) => (
              <SeatCell key={seat.id} seat={seat} onTap={onSeatTap} dark={dark} />
            ))}
          </div>
        );
      })}

      {/* 凡例 */}
      <div className={`flex gap-4 mt-4 justify-center text-sm ${dark ? "text-gray-300" : ""}`}>
        <span className="flex items-center gap-1">
          <span className={`w-4 h-4 rounded inline-block ${dark ? "bg-green-600" : "bg-green-400"}`} /> 空席
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-4 h-4 rounded inline-block ${dark ? "bg-yellow-500" : "bg-yellow-400"}`} /> 待機中
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-4 h-4 rounded inline-block ${dark ? "bg-orange-500" : "bg-orange-400"}`} /> 案内中
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-4 h-4 rounded inline-block ${dark ? "bg-gray-600" : "bg-gray-400"}`} /> 着席済
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-4 h-4 rounded inline-block ${dark ? "bg-slate-700" : "bg-slate-800"}`} /> 機材
        </span>
      </div>
    </div>
  );
}
