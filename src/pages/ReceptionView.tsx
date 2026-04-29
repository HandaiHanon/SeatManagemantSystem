import { useState, useMemo } from "react";
import { useSeats } from "../hooks/useSeats";
import {
  assignSeatsByIds,
  cancelGroup,
} from "../lib/seatService";
import { recommendSeats, type ScoredCandidate } from "../lib/recommend";
import type { Seat } from "../lib/types";

type Phase = "select-count" | "confirm-seats";

export function ReceptionView() {
  const { seats, loading } = useSeats();
  const [phase, setPhase] = useState<Phase>("select-count");
  const [count, setCount] = useState(1);
  const [customCount, setCustomCount] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recommendation, setRecommendation] = useState<ScoredCandidate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableCount = seats.filter(
    (s) => s.type === "normal" && s.status === "available"
  ).length;

  // 待機中グループ一覧
  const waitingGroups = useMemo(() => {
    const groups = new Map<string, Seat[]>();
    for (const seat of seats) {
      if (seat.status === "waiting" && seat.groupId) {
        const g = groups.get(seat.groupId) || [];
        g.push(seat);
        groups.set(seat.groupId, g);
      }
    }
    return [...groups.entries()].sort((a, b) => {
      const tA = a[1][0]?.updatedAt?.seconds ?? 0;
      const tB = b[1][0]?.updatedAt?.seconds ?? 0;
      return tB - tA;
    });
  }, [seats]);

  const handleSelectCount = (n: number) => {
    setCount(n);
    setMessage(null);
    const results = recommendSeats(seats, n, 1);
    if (results.length > 0) {
      const best = results[0];
      setRecommendation(best);
      setSelectedIds(new Set(best.seats.map((s) => s.id)));
    } else {
      setRecommendation(null);
      setSelectedIds(new Set());
      setMessage(`${n}名分の連続した空席がありません。手動で選択してください。`);
    }
    setPhase("confirm-seats");
  };

  const handleCustomSubmit = () => {
    const n = parseInt(customCount, 10);
    if (!n || n < 1) return;
    handleSelectCount(n);
  };

  const toggleSeat = (seat: Seat) => {
    if (seat.type === "equipment" || seat.status !== "available") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else next.add(seat.id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await assignSeatsByIds(seats, [...selectedIds]);
      setMessage(`${[...selectedIds].join(", ")} を確保しました`);
      setPhase("select-count");
      setSelectedIds(new Set());
      setCustomCount("");
    } catch (err) {
      setMessage("エラーが発生しました");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setPhase("select-count");
    setSelectedIds(new Set());
    setRecommendation(null);
    setMessage(null);
  };

  const handleCancel = async (groupId: string) => {
    try {
      await cancelGroup(seats, groupId);
      setMessage("取り消しました");
    } catch (err) {
      setMessage("取消に失敗しました");
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  // ==================== 座席確認フェーズ ====================
  if (phase === "confirm-seats") {
    const rows = [...new Set(seats.map((s) => s.row))].sort();
    const seatsByRow = new Map<string, Seat[]>();
    for (const seat of seats) {
      const arr = seatsByRow.get(seat.row) || [];
      arr.push(seat);
      seatsByRow.set(seat.row, arr);
    }

    return (
      <div className="p-3 sm:p-4 max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handleBack}
            className="px-3 py-2 text-sm rounded bg-gray-200 hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            戻る
          </button>
          <span className="text-xs sm:text-sm text-gray-600">
            <strong className="text-base sm:text-lg">{selectedIds.size}</strong> 席選択中
            {count > 0 && <span className="text-gray-400 hidden sm:inline"> / 推奨 {count}名</span>}
          </span>
          <button
            onClick={handleConfirm}
            disabled={submitting || selectedIds.size === 0}
            className="px-4 sm:px-5 py-2 text-sm font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            {submitting ? "..." : "確定"}
          </button>
        </div>

        {message && (
          <div className="mb-3 p-2 rounded bg-yellow-50 border border-yellow-200 text-center text-sm">
            {message}
          </div>
        )}

        {/* スコア内訳 */}
        {recommendation && (
          <div className="mb-3 p-2 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-700">おすすめ理由</span>
              <span className="text-xs text-blue-500">
                ({recommendation.score.toFixed(1)}pt)
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {([
                ["見やすさ", recommendation.breakdown.row],
                ["中央度", recommendation.breakdown.center],
                ["密集度", recommendation.breakdown.cluster],
                ["隙間回避", recommendation.breakdown.gap],
                ["通路", recommendation.breakdown.aisle],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-gray-500">{label}</span>
                  <div className="w-10 sm:w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${val * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-2">
          青=おすすめ席。タップで選択/解除。空席(緑)のみ選択可。
        </p>

        {/* 座席グリッド */}
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="inline-block">
            <div className="flex gap-0.5 ml-6 sm:ml-7 mb-0.5">
              {seats.filter((s) => s.row === rows[0]).sort((a, b) => a.col - b.col).map((s) => (
                <div key={s.col} className="w-9 sm:w-11 text-center text-[10px] sm:text-xs text-gray-400">
                  {s.col}
                </div>
              ))}
            </div>
            {rows.map((row) => {
              const rowSeats = (seatsByRow.get(row) || []).sort((a, b) => a.col - b.col);
              return (
                <div key={row} className="flex gap-0.5 items-center mb-0.5">
                  <div className="w-5 sm:w-6 text-center text-[10px] sm:text-xs font-bold text-gray-500">{row}</div>
                  {rowSeats.map((seat) => {
                    const isSelected = selectedIds.has(seat.id);
                    const isEquip = seat.type === "equipment";
                    const isAvailable = seat.status === "available";

                    let bg = "";
                    if (isEquip) bg = "bg-slate-800 text-slate-400";
                    else if (isSelected) bg = "bg-blue-400 text-white";
                    else if (isAvailable) bg = "bg-green-300 hover:bg-green-400 active:bg-green-500 text-gray-700";
                    else if (seat.status === "waiting") bg = "bg-yellow-400 text-gray-700";
                    else if (seat.status === "guiding") bg = "bg-orange-400 text-gray-700";
                    else bg = "bg-gray-400 text-gray-600";

                    return (
                      <button
                        key={seat.id}
                        onClick={() => toggleSeat(seat)}
                        disabled={isEquip || !isAvailable}
                        className={`w-9 h-9 sm:w-11 sm:h-10 rounded text-[9px] sm:text-[10px] font-medium select-none transition-colors ${bg} ${
                          isAvailable && !isEquip ? "cursor-pointer" : "cursor-default"
                        } ${isSelected ? "ring-2 ring-blue-600" : ""}`}
                      >
                        {seat.id}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==================== 人数選択フェーズ ====================
  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <p className="text-4xl font-bold text-gray-800">{availableCount}</p>
        <p className="text-gray-500 text-sm">残り空席数</p>
      </div>

      {/* クイック選択ボタン */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => handleSelectCount(n)}
            disabled={availableCount < n}
            className="h-20 sm:h-24 text-2xl sm:text-3xl font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {n}名
          </button>
        ))}
      </div>

      {/* 自由入力 */}
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          min={1}
          value={customCount}
          onChange={(e) => setCustomCount(e.target.value)}
          placeholder="5名以上"
          className="flex-1 rounded-lg border border-gray-300 px-3 sm:px-4 py-3 text-base sm:text-lg"
        />
        <button
          onClick={handleCustomSubmit}
          disabled={!customCount || parseInt(customCount, 10) < 1}
          className="px-5 sm:px-6 py-3 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          選択
        </button>
      </div>

      {message && (
        <div className="mt-2 p-3 rounded-lg bg-gray-100 text-center text-base font-medium">
          {message}
        </div>
      )}

      {/* 待機中グループ一覧 */}
      {waitingGroups.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">
            登録済み（待機中）
          </h3>
          <div className="space-y-2">
            {waitingGroups.map(([groupId, groupSeats]) => (
              <div
                key={groupId}
                className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 sm:px-4 py-2"
              >
                <span className="text-sm text-gray-700 mr-2 min-w-0 truncate">
                  <strong>{groupSeats.length}名</strong>{" "}
                  {groupSeats.map((s) => s.id).join(", ")}
                </span>
                <button
                  onClick={() => handleCancel(groupId)}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors shrink-0"
                >
                  取消
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
