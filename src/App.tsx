import { useState } from "react";
import { ReceptionView } from "./pages/ReceptionView";
import { GuideView } from "./pages/GuideView";
import { SetupView } from "./pages/SetupView";
import { LogView } from "./pages/LogView";
import { PeakSwitchWarning } from "./components/PeakSwitchWarning";
import { useAppState } from "./hooks/useAppState";
import { useQueue } from "./hooks/useQueue";
import { togglePeakMode } from "./lib/seatService";

type Tab = "reception" | "guide" | "setup" | "log";

const TABS: { key: Tab; label: string }[] = [
  { key: "reception", label: "受付係" },
  { key: "guide", label: "案内係" },
  { key: "setup", label: "設定" },
  { key: "log", label: "ログ" },
];

function App() {
  const [tab, setTab] = useState<Tab>("reception");
  const { appState } = useAppState();
  const { queue } = useQueue();
  const [showWarning, setShowWarning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [peakError, setPeakError] = useState<string | null>(null);

  const peakMode = appState.peakMode;
  const discrepancy = appState.peakConsumedCount - appState.peakMarkedCount;

  const handleTogglePeak = async () => {
    if (toggling) return;

    // peak→normal 切替時に差分チェック
    if (peakMode && discrepancy > 0) {
      setShowWarning(true);
      return;
    }

    setToggling(true);
    setPeakError(null);
    try {
      await togglePeakMode(peakMode);
    } catch (err) {
      console.error("ピークモード切替エラー:", err);
      setPeakError("切替に失敗しました");
      setTimeout(() => setPeakError(null), 3000);
    } finally {
      setToggling(false);
    }
  };

  const handleForceSwitch = async () => {
    setShowWarning(false);
    setToggling(true);
    setPeakError(null);
    try {
      await togglePeakMode(peakMode);
    } catch (err) {
      console.error("ピークモード切替エラー:", err);
      setPeakError("切替に失敗しました");
      setTimeout(() => setPeakError(null), 3000);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー + タブ */}
      <header className={`bg-[#1a7de8] ${peakMode ? "border-b-4 border-red-600" : "border-b border-blue-700"}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <img src="/hanon-logo.jpg" alt="Hanon" className="h-8 w-8 rounded-full object-cover" />
            <h1 className="text-base sm:text-lg font-bold text-white">
              Hanon 座席管理
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {peakError && (
              <span className="text-xs text-red-200 bg-red-800/50 px-2 py-0.5 rounded">{peakError}</span>
            )}
            <button
              onClick={handleTogglePeak}
              disabled={toggling}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                peakMode
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {toggling ? "..." : peakMode ? "PEAK ON" : "PEAK"}
            </button>
          </div>
        </div>
        <div className={`flex ${peakMode ? "bg-red-800" : "bg-[#1565c0]"}`}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-white text-white"
                  : peakMode
                    ? "text-red-200 hover:text-white"
                    : "text-blue-200 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ビュー */}
      <main>
        {tab === "reception" && <ReceptionView peakMode={peakMode} queue={queue} />}
        {tab === "guide" && <GuideView peakMode={peakMode} queue={queue} appState={appState} />}
        {tab === "setup" && <SetupView />}
        {tab === "log" && <LogView />}
      </main>

      {/* 安全ロック警告 */}
      {showWarning && (
        <PeakSwitchWarning
          discrepancy={discrepancy}
          onConfirm={handleForceSwitch}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </div>
  );
}

export default App;
