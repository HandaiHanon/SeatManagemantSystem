import { useState } from "react";
import { ReceptionView } from "./pages/ReceptionView";
import { GuideView } from "./pages/GuideView";
import { SetupView } from "./pages/SetupView";
import { LogView } from "./pages/LogView";

type Tab = "reception" | "guide" | "setup" | "log";

const TABS: { key: Tab; label: string }[] = [
  { key: "reception", label: "受付係" },
  { key: "guide", label: "案内係" },
  { key: "setup", label: "設定" },
  { key: "log", label: "ログ" },
];

function App() {
  const [tab, setTab] = useState<Tab>("reception");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー + タブ */}
      <header className="bg-[#1a7de8] border-b border-blue-700">
        <div className="flex items-center justify-center gap-2 py-2">
          <img src="/hanon-logo.jpg" alt="Hanon" className="h-8 w-8 rounded-full object-cover" />
          <h1 className="text-lg font-bold text-white">
            Hanon 座席管理システム
          </h1>
        </div>
        <div className="flex bg-[#1565c0]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-white text-white"
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
        {tab === "reception" && <ReceptionView />}
        {tab === "guide" && <GuideView />}
        {tab === "setup" && <SetupView />}
        {tab === "log" && <LogView />}
      </main>
    </div>
  );
}

export default App;
