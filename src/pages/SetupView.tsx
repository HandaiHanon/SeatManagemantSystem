import { useState, useMemo, useEffect } from "react";
import { useSeats } from "../hooks/useSeats";
import { saveLayout, resetAllSeats, clearQueue, type SeatConfig } from "../lib/seatService";
import type { Block, SeatType } from "../lib/types";

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function SetupView() {
  const { seats, loading } = useSeats();

  const [rowCount, setRowCount] = useState(10);
  const [colCount, setColCount] = useState(10);
  const [frontEnd, setFrontEnd] = useState(3);
  const [backStart, setBackStart] = useState(8);
  const [equipmentSet, setEquipmentSet] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Firestoreの現在データから初期値を復元（初回のみ）
  useEffect(() => {
    if (loading || initialized) return;
    setInitialized(true);

    if (seats.length === 0) return;

    const rows = [...new Set(seats.map((s) => s.row))].sort();
    const maxCol = Math.max(...seats.map((s) => s.col));

    setRowCount(rows.length);
    setColCount(maxCol);

    // ブロック境界を復元
    const frontRows = seats.filter((s) => s.block === "front").map((s) => s.row);
    const backRows = seats.filter((s) => s.block === "back").map((s) => s.row);
    const uniqueFront = [...new Set(frontRows)].sort();
    const uniqueBack = [...new Set(backRows)].sort();

    if (uniqueFront.length > 0) {
      setFrontEnd(uniqueFront.length);
    }
    if (uniqueBack.length > 0) {
      setBackStart(rows.length - uniqueBack.length + 1);
    }

    // 機材席を復元
    const equip = new Set(
      seats.filter((s) => s.type === "equipment").map((s) => s.id)
    );
    setEquipmentSet(equip);
  }, [loading, seats, initialized]);

  const rows = ROW_LETTERS.slice(0, rowCount);

  const getBlock = (rowIndex: number): Block => {
    if (rowIndex < frontEnd) return "front";
    if (rowIndex >= backStart - 1) return "back";
    return "center";
  };

  const blockColor = (rowIndex: number) => {
    const block = getBlock(rowIndex);
    if (block === "front") return "bg-blue-50 border-blue-200";
    if (block === "back") return "bg-red-50 border-red-200";
    return "bg-gray-50 border-gray-200";
  };

  const toggleEquipment = (id: string) => {
    setEquipmentSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seatConfigs = useMemo((): SeatConfig[] => {
    const configs: SeatConfig[] = [];
    for (let r = 0; r < rowCount; r++) {
      for (let c = 1; c <= colCount; c++) {
        const id = `${rows[r]}-${c}`;
        configs.push({
          id,
          row: rows[r],
          col: c,
          block: getBlock(r),
          type: (equipmentSet.has(id) ? "equipment" : "normal") as SeatType,
        });
      }
    }
    return configs;
  }, [rowCount, colCount, frontEnd, backStart, equipmentSet]);

  const handleSave = async () => {
    if (!confirm("現在の座席データをすべてリセットして新しいレイアウトを保存しますか？")) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveLayout(seatConfigs);
      setMessage(`${seatConfigs.length}席のレイアウトを保存しました`);
    } catch (err) {
      console.error(err);
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto">
      {/* レイアウト設定 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">行数 (A~)</span>
          <input
            type="number"
            min={1}
            max={26}
            value={rowCount}
            onChange={(e) => setRowCount(Math.max(1, Math.min(26, Number(e.target.value))))}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">列数</span>
          <input
            type="number"
            min={1}
            max={50}
            value={colCount}
            onChange={(e) => setColCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {/* ブロック境界設定 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            前方ブロック (<span className="text-blue-600">front</span>): 1行目 ~ {frontEnd}行目
          </span>
          <input
            type="range"
            min={1}
            max={rowCount - 1}
            value={frontEnd}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFrontEnd(v);
              if (backStart <= v) setBackStart(v + 1);
            }}
            className="mt-1 block w-full"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            後方ブロック (<span className="text-red-600">back</span>): {backStart}行目 ~ {rowCount}行目
          </span>
          <input
            type="range"
            min={2}
            max={rowCount}
            value={backStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBackStart(v);
              if (frontEnd >= v) setFrontEnd(v - 1);
            }}
            className="mt-1 block w-full"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        席をクリックすると機材席(黒)に切り替えられます。もう一度クリックで通常席に戻ります。
      </p>

      {/* プレビューグリッド */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-4">
        <div className="inline-block">
          {/* 列番号 */}
          <div className="flex gap-0.5 ml-8 sm:ml-10 mb-0.5">
            {Array.from({ length: colCount }, (_, i) => (
              <div key={i} className="w-8 sm:w-10 text-center text-[10px] sm:text-xs text-gray-500">
                {i + 1}
              </div>
            ))}
          </div>

          {rows.map((row, rowIndex) => (
            <div key={row} className="flex gap-0.5 items-center mb-0.5">
              {/* 行ラベル + ブロック表示 */}
              <div className="w-8 sm:w-10 flex items-center gap-0.5 sm:gap-1">
                <span className="text-xs sm:text-sm font-bold text-gray-600">{row}</span>
                <span className={`text-[8px] sm:text-[10px] px-0.5 sm:px-1 rounded ${
                  getBlock(rowIndex) === "front" ? "text-blue-600 bg-blue-100" :
                  getBlock(rowIndex) === "back" ? "text-red-600 bg-red-100" :
                  "text-gray-500 bg-gray-100"
                }`}>
                  {getBlock(rowIndex)[0].toUpperCase()}
                </span>
              </div>

              {Array.from({ length: colCount }, (_, c) => {
                const id = `${row}-${c + 1}`;
                const isEquip = equipmentSet.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleEquipment(id)}
                    className={`w-8 h-8 sm:w-10 sm:h-8 rounded text-[8px] sm:text-[10px] font-medium select-none transition-colors border ${
                      isEquip
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : `${blockColor(rowIndex)} text-gray-600 hover:bg-green-100 active:bg-green-200`
                    }`}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ステータス */}
      <div className="flex flex-wrap gap-1 mb-4 text-xs sm:text-sm text-gray-600">
        <span>通常: <strong>{seatConfigs.filter((s) => s.type === "normal").length}</strong></span>
        <span>/</span>
        <span>機材: <strong>{seatConfigs.filter((s) => s.type === "equipment").length}</strong></span>
        <span>/</span>
        <span>合計: <strong>{seatConfigs.length}</strong></span>
      </div>

      {/* ボタン群 */}
      <div className="space-y-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
        >
          {saving ? "保存中..." : "このレイアウトを保存"}
        </button>

        <button
          onClick={async () => {
            if (!confirm("着席状況をリセットして全席を空席に戻しますか？")) return;
            setSaving(true);
            setMessage(null);
            try {
              const count = await resetAllSeats(seats);
              setMessage(count > 0 ? `${count}席をリセットしました` : "リセット対象の席がありません");
            } catch (err) {
              console.error(err);
              setMessage("リセットに失敗しました");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 disabled:bg-gray-300 transition-colors"
        >
          着席状況をリセット
        </button>

        <button
          onClick={async () => {
            if (!confirm("待機キューを全件削除しますか？")) return;
            setSaving(true);
            setMessage(null);
            try {
              const count = await clearQueue();
              setMessage(count > 0 ? `${count}件のキューを削除しました` : "削除対象のキューがありません");
            } catch (err) {
              console.error(err);
              setMessage("キュー削除に失敗しました");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:bg-gray-300 transition-colors"
        >
          待機キューを全削除
        </button>
      </div>

      {message && (
        <div className="mt-3 p-3 rounded-lg bg-gray-100 text-center text-sm font-medium">
          {message}
        </div>
      )}
    </div>
  );
}
