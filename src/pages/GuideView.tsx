import { useState } from "react";
import { useSeats } from "../hooks/useSeats";
import { transitionSeat } from "../lib/seatService";
import { SeatGrid } from "../components/SeatGrid";
import type { Seat } from "../lib/types";

export function GuideView() {
  const { seats, loading } = useSeats();
  const [dark, setDark] = useState(false);

  const handleSeatTap = async (seat: Seat) => {
    if (seat.status !== "waiting" && seat.status !== "guiding" && seat.status !== "seated") return;

    try {
      await transitionSeat(seat);
    } catch (err) {
      console.error("状態遷移エラー:", err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  const waitingCount = seats.filter((s) => s.status === "waiting").length;
  const guidingCount = seats.filter((s) => s.status === "guiding").length;
  const seatedCount = seats.filter((s) => s.status === "seated").length;

  // 案内待ちキュー
  const waitingGroups = new Map<string, Seat[]>();
  for (const seat of seats) {
    if (seat.status === "waiting" && seat.groupId) {
      const group = waitingGroups.get(seat.groupId) || [];
      group.push(seat);
      waitingGroups.set(seat.groupId, group);
    }
  }
  const sortedGroups = [...waitingGroups.entries()].sort((a, b) => {
    const timeA = a[1][0]?.updatedAt?.seconds ?? 0;
    const timeB = b[1][0]?.updatedAt?.seconds ?? 0;
    return timeA - timeB;
  });

  const bg = dark ? "bg-gray-900 min-h-screen" : "";
  const textMain = dark ? "text-gray-200" : "";
  const textMuted = dark ? "text-gray-400" : "text-gray-400";

  return (
    <div className={`p-3 sm:p-4 ${bg} ${textMain}`}>
      {/* ダークモードトグル + ステータス */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm ${dark ? "text-gray-300" : ""}`}>
          <span>
            待機: <strong className={dark ? "text-yellow-400" : "text-yellow-600"}>{waitingCount}</strong>
          </span>
          <span>
            案内: <strong className={dark ? "text-orange-400" : "text-orange-600"}>{guidingCount}</strong>
          </span>
          <span>
            着席: <strong className={dark ? "text-gray-400" : "text-gray-600"}>{seatedCount}</strong>
          </span>
        </div>
        <button
          onClick={() => setDark((d) => !d)}
          className={`px-3 py-1.5 text-xs sm:text-sm rounded transition-colors shrink-0 ${
            dark
              ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {dark ? "ライト" : "ダーク"}
        </button>
      </div>

      {/* 案内待ちキュー */}
      {sortedGroups.length > 0 && (
        <div className="mb-4 mx-auto max-w-md">
          <h3 className={`text-sm font-bold mb-2 ${dark ? "text-gray-300" : "text-gray-700"}`}>
            案内待ちキュー
          </h3>
          <div className="space-y-1">
            {sortedGroups.map(([groupId, groupSeats], i) => (
              <div
                key={groupId}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm ${
                  dark
                    ? "bg-yellow-900/30 border border-yellow-700"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <span className={`font-bold ${dark ? "text-yellow-400" : "text-yellow-700"}`}>
                  #{i + 1}
                </span>
                <span className={dark ? "text-gray-300" : "text-gray-700"}>
                  {groupSeats.length}名 — {groupSeats.map((s) => s.id).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center overflow-x-auto">
        <SeatGrid seats={seats} onSeatTap={handleSeatTap} dark={dark} />
      </div>

      <p className={`text-center text-xs mt-4 ${textMuted}`}>
        黄(待機) → 橙(案内中) → 灰(着席) → タップで空席に戻す
      </p>
    </div>
  );
}
