import { useMemo, useRef } from "react";
import { useSeats } from "../hooks/useSeats";
import { transitionSeat, consumeQueueItem, markSeatsAsSeated } from "../lib/seatService";
import { SeatGrid } from "../components/SeatGrid";
import type { Seat, QueueItem, AppState, Block } from "../lib/types";

interface Props {
  peakMode: boolean;
  queue: QueueItem[];
  appState: AppState;
}

export function GuideView({ peakMode, queue, appState }: Props) {
  const { seats, loading } = useSeats();

  const handleSeatTap = async (seat: Seat) => {
    // ピークモード: 空席タップで直接 seated にマーク
    if (peakMode && seat.status === "available") {
      try {
        await markSeatsAsSeated(seats, [seat.id]);
      } catch (err) {
        console.error("マークエラー:", err);
      }
      return;
    }

    if (seat.status !== "waiting" && seat.status !== "guiding" && seat.status !== "seated") return;
    try {
      await transitionSeat(seat);
    } catch (err) {
      console.error("状態遷移エラー:", err);
    }
  };

  // キュー消化（スワイプ対応）
  const touchStartX = useRef<number | null>(null);
  const handleQueueTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleQueueTouchEnd = (e: React.TouchEvent, item: QueueItem) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX > 100) {
      handleConsume(item);
    }
  };

  const handleConsume = async (item: QueueItem) => {
    try {
      await consumeQueueItem(item.id, item.count);
    } catch (err) {
      console.error("キュー消化エラー:", err);
    }
  };

  // 統計
  const waitingCount = seats.filter((s) => s.status === "waiting").length;
  const guidingCount = seats.filter((s) => s.status === "guiding").length;
  const seatedCount = seats.filter((s) => s.status === "seated").length;

  // ブロック別空席率
  const blockStats = useMemo(() => {
    const blocks: Block[] = ["front", "center", "back"];
    const blockLabels: Record<Block, string> = { front: "前方", center: "中央", back: "後方" };

    return blocks.map((block) => {
      const total = seats.filter((s) => s.block === block && s.type === "normal").length;
      const available = seats.filter(
        (s) => s.block === block && s.type === "normal" && s.status === "available"
      ).length;
      const rate = total > 0 ? available / total : 0;
      return { block, label: blockLabels[block], total, available, rate };
    });
  }, [seats]);

  // ピーク差分
  const discrepancy = appState.peakConsumedCount - appState.peakMarkedCount;

  // 待機キュー（pending のみ）
  const pendingQueue = useMemo(
    () => queue.filter((q) => q.status === "pending"),
    [queue]
  );
  const pendingTotal = useMemo(
    () => pendingQueue.reduce((sum, q) => sum + q.count, 0),
    [pendingQueue]
  );

  // 通常モード: 案内待ちグループ
  const sortedGroups = useMemo(() => {
    const waitingGroups = new Map<string, Seat[]>();
    for (const seat of seats) {
      if (seat.status === "waiting" && seat.groupId) {
        const group = waitingGroups.get(seat.groupId) || [];
        group.push(seat);
        waitingGroups.set(seat.groupId, group);
      }
    }
    return [...waitingGroups.entries()].sort((a, b) => {
      const timeA = a[1][0]?.updatedAt?.seconds ?? 0;
      const timeB = b[1][0]?.updatedAt?.seconds ?? 0;
      return timeA - timeB;
    });
  }, [seats]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 bg-black min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="p-3 sm:p-4 bg-black min-h-screen text-neutral-300">
      {/* ピークモード: マクロ状況パネル */}
      {peakMode && (
        <div className="border-b-4 border-red-900 pb-3 mb-3">
          {/* 待ち人数 + 差分バッジ */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-3xl font-bold text-neutral-300">{pendingTotal}</span>
              <span className="text-sm text-gray-500 ml-2">名 待ち</span>
            </div>
            {discrepancy > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-900/60 text-red-400 text-sm font-bold">
                +{discrepancy} 未入力
              </span>
            )}
          </div>

          {/* ブロック別空席率 */}
          <div className="flex gap-2">
            {blockStats.map(({ block, label, rate }) => {
              let statusText: string;
              let statusClass: string;
              if (rate === 0) {
                statusText = "満席";
                statusClass = "text-red-500/80 bg-red-950 border-red-900";
              } else if (rate < 0.2) {
                statusText = "残少";
                statusClass = "text-orange-500/70 bg-orange-950 border-orange-900";
              } else {
                statusText = "空有";
                statusClass = "text-green-600/70 bg-green-950 border-green-900";
              }

              return (
                <div
                  key={block}
                  className={`flex-1 text-center py-1.5 rounded border ${statusClass}`}
                >
                  <div className="text-[10px] text-gray-500">{label}</div>
                  <div className="text-sm font-bold">{statusText}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ステータスバー */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm mb-3">
        <span>
          待機: <strong className="text-yellow-500/80">{waitingCount}</strong>
        </span>
        <span>
          案内: <strong className="text-orange-500/80">{guidingCount}</strong>
        </span>
        <span>
          着席: <strong className="text-gray-500">{seatedCount}</strong>
        </span>
      </div>

      {/* ピークモード: キューリスト */}
      {peakMode && pendingQueue.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-neutral-400 mb-2">
            待機キュー
          </h3>
          <div className="space-y-1">
            {pendingQueue.map((item, i) => {
              const ts = item.timestamp?.toDate?.();
              const timeStr = ts
                ? `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`
                : "";

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded px-3 py-2 bg-slate-900 border border-slate-700"
                  onTouchStart={handleQueueTouchStart}
                  onTouchEnd={(e) => handleQueueTouchEnd(e, item)}
                >
                  <span className="font-bold text-yellow-500/80 w-8">#{i + 1}</span>
                  <span className="flex-1 text-neutral-300">
                    {item.count}名
                  </span>
                  <span className="text-xs text-gray-500 mr-2">{timeStr}</span>
                  <button
                    onClick={() => handleConsume(item)}
                    className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600 text-green-500/80 text-sm font-bold hover:bg-slate-700 transition-colors"
                  >
                    ✓
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 mt-1">← スワイプで消化</p>
        </div>
      )}

      {/* 通常モード: 案内待ちキュー */}
      {!peakMode && sortedGroups.length > 0 && (
        <div className="mb-4 mx-auto max-w-md">
          <h3 className="text-sm font-bold text-neutral-400 mb-2">
            案内待ちキュー
          </h3>
          <div className="space-y-1">
            {sortedGroups.map(([groupId, groupSeats], i) => (
              <div
                key={groupId}
                className="flex items-center gap-2 rounded px-3 py-1.5 bg-yellow-900/30 border border-yellow-900"
              >
                <span className="font-bold text-yellow-500/80">
                  #{i + 1}
                </span>
                <span className="text-neutral-300">
                  {groupSeats.length}名 — {groupSeats.map((s) => s.id).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 座席グリッド */}
      <div className="flex justify-center overflow-x-auto">
        <SeatGrid
          seats={seats}
          onSeatTap={handleSeatTap}
          dark={true}
          availableClickable={peakMode}
        />
      </div>

      <p className="text-center text-xs mt-4 text-gray-600">
        {peakMode
          ? "空席タップで着席済にマーク"
          : "黄(待機) → 橙(案内中) → 灰(着席) → タップで空席に戻す"}
      </p>
    </div>
  );
}
