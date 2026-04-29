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
      <header className="bg-white border-b border-gray-200">
        <h1 className="text-center text-lg font-bold py-2 text-gray-800">
          座席管理システム
        </h1>
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
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
