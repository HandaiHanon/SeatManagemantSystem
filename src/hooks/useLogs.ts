import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { OperationLog } from "../lib/types";

export function useLogs() {
  const [logs, setLogs] = useState<(OperationLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "operation_logs"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (OperationLog & { id: string })[];
        setLogs(data);
        setLoading(false);
      },
      (err) => {
        console.error("ログ取得エラー:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { logs, loading };
}
