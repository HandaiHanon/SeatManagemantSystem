import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AppState } from "../lib/types";

const DEFAULT_STATE: AppState = {
  peakMode: false,
  peakConsumedCount: 0,
  peakMarkedCount: 0,
  updatedAt: null as any,
};

export function useAppState() {
  const [appState, setAppState] = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "app_state", "current"),
      (snapshot) => {
        if (snapshot.exists()) {
          setAppState(snapshot.data() as AppState);
        } else {
          setAppState(DEFAULT_STATE);
        }
        setLoading(false);
      },
      (err) => {
        console.error("AppState取得エラー:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { appState, loading };
}
