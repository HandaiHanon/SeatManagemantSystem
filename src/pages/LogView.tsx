import { useMemo } from "react";
import { useLogs } from "../hooks/useLogs";
import { useSeats } from "../hooks/useSeats";

const STATUS_LABEL: Record<string, string> = {
  available: "空席",
  waiting: "待機中",
  guiding: "案内中",
  seated: "着席済",
};

export function LogView() {
  const { logs, loading: logsLoading } = useLogs();
  const { seats, loading: seatsLoading } = useSeats();

  // 統計サマリー
  const stats = useMemo(() => {
    const totalSeated = seats.filter((s) => s.status === "seated").length;
    const totalWaiting = seats.filter((s) => s.status === "waiting").length;
    const totalGuiding = seats.filter((s) => s.status === "guiding").length;
    const totalAvailable = seats.filter(
      (s) => s.type === "normal" && s.status === "available"
    ).length;

    // 累計入場数: available→waitingの遷移回数
    const totalEntries = logs.filter(
      (l) => l.previousStatus === "available" && l.newStatus === "waiting"
    ).length;

    return { totalSeated, totalWaiting, totalGuiding, totalAvailable, totalEntries };
  }, [logs, seats]);

  // 時間帯別入場数（10分刻み）
  const timeChart = useMemo(() => {
    const entryLogs = logs.filter(
      (l) => l.previousStatus === "available" && l.newStatus === "waiting" && l.timestamp
    );

    const buckets = new Map<string, number>();

    for (const log of entryLogs) {
      const date = log.timestamp.toDate();
      const h = date.getHours().toString().padStart(2, "0");
      const m = (Math.floor(date.getMinutes() / 10) * 10).toString().padStart(2, "0");
      const key = `${h}:${m}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const maxCount = Math.max(...sorted.map(([, c]) => c), 1);

    return { sorted, maxCount };
  }, [logs]);

  // CSVエクスポート
  const handleExport = () => {
    const header = "seatId,previousStatus,newStatus,groupId,timestamp";
    const rows = logs.map((l) => {
      const ts = l.timestamp?.toDate().toISOString() ?? "";
      return `${l.seatId},${l.previousStatus},${l.newStatus},${l.groupId ?? ""},${ts}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operation_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (logsLoading || seatsLoading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto">
      {/* 統計サマリー */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
        {([
          ["累計入場", stats.totalEntries, "text-blue-600"],
          ["着席中", stats.totalSeated, "text-gray-600"],
          ["案内中", stats.totalGuiding, "text-orange-600"],
          ["待機中", stats.totalWaiting, "text-yellow-600"],
          ["空席", stats.totalAvailable, "text-green-600"],
        ] as [string, number, string][]).map(([label, val, color]) => (
          <div key={label} className="text-center p-2 bg-white rounded-lg border border-gray-200">
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-[10px] sm:text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* 時間帯別グラフ */}
      {timeChart.sorted.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">時間帯別入場数（10分刻み）</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="space-y-1">
              {timeChart.sorted.map(([time, count]) => (
                <div key={time} className="flex items-center gap-2 text-sm">
                  <span className="w-12 text-right text-gray-500 font-mono text-xs">{time}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded"
                      style={{ width: `${(count / timeChart.maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* エクスポート */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-700">
          操作履歴（{logs.length}件）
        </h3>
        <button
          onClick={handleExport}
          disabled={logs.length === 0}
          className="px-4 py-1.5 text-sm rounded bg-gray-700 text-white hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
        >
          CSVエクスポート
        </button>
      </div>

      {/* ログテーブル */}
      {logs.length === 0 ? (
        <p className="text-center text-gray-400 py-8">操作ログがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[10px] sm:text-xs text-gray-500">
                <th className="py-2 px-1 sm:px-2">時刻</th>
                <th className="py-2 px-1 sm:px-2">座席</th>
                <th className="py-2 px-1 sm:px-2">前</th>
                <th className="py-2 px-1 sm:px-2">後</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 200).map((log) => {
                const ts = log.timestamp?.toDate();
                const timeStr = ts
                  ? `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}:${ts.getSeconds().toString().padStart(2, "0")}`
                  : "-";

                return (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1.5 px-1 sm:px-2 font-mono text-[10px] sm:text-xs text-gray-500">{timeStr}</td>
                    <td className="py-1.5 px-1 sm:px-2 font-medium">{log.seatId}</td>
                    <td className="py-1.5 px-1 sm:px-2 text-gray-500">
                      {STATUS_LABEL[log.previousStatus] || log.previousStatus}
                    </td>
                    <td className="py-1.5 px-1 sm:px-2 font-medium">
                      {STATUS_LABEL[log.newStatus] || log.newStatus}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {logs.length > 200 && (
            <p className="text-center text-xs text-gray-400 py-2">
              最新200件を表示中（全{logs.length}件）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
