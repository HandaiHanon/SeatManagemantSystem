import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { QueueItem } from "../lib/types";

export function useQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "queue"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as QueueItem[];
        setQueue(data);
        setLoading(false);
      },
      (err) => {
        console.error("キュー取得エラー:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { queue, loading };
}
