import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  setDoc,
  addDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { db } from "./firebase";
import type { Seat, SeatStatus, SeatType, Block } from "./types";

/**
 * 同一行内で count 個の連続した空席を探す（前方行から優先）
 */
export function findConsecutiveSeats(seats: Seat[], count: number): Seat[] | null {
  const rows = [...new Set(seats.map((s) => s.row))].sort();

  for (const row of rows) {
    const rowSeats = seats
      .filter((s) => s.row === row && s.type === "normal" && s.status === "available")
      .sort((a, b) => a.col - b.col);

    let consecutive: Seat[] = [];
    for (const seat of rowSeats) {
      if (
        consecutive.length === 0 ||
        seat.col === consecutive[consecutive.length - 1].col + 1
      ) {
        consecutive.push(seat);
        if (consecutive.length === count) return consecutive;
      } else {
        consecutive = [seat];
      }
    }
  }

  return null;
}

/**
 * 指定された座席IDリストをwaitingに変更する
 */
export async function assignSeatsByIds(
  seats: Seat[],
  seatIds: string[]
): Promise<void> {
  const groupId = uuidv4();
  const batch = writeBatch(db);

  for (const id of seatIds) {
    const seat = seats.find((s) => s.id === id);
    if (!seat || seat.status !== "available") continue;

    const seatRef = doc(db, "seats", id);
    batch.update(seatRef, {
      status: "waiting" as SeatStatus,
      groupId,
      updatedAt: serverTimestamp(),
    });

    const logRef = doc(collection(db, "operation_logs"));
    batch.set(logRef, {
      seatId: id,
      previousStatus: "available",
      newStatus: "waiting",
      groupId,
      timestamp: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * 座席の状態を次の段階に遷移させる
 * waiting → guiding → seated → available
 */
export async function transitionSeat(seat: Seat): Promise<void> {
  const nextStatus: Record<string, SeatStatus> = {
    waiting: "guiding",
    guiding: "seated",
    seated: "available",
  };

  const newStatus = nextStatus[seat.status];
  if (!newStatus) return;

  const batch = writeBatch(db);

  const seatRef = doc(db, "seats", seat.id);
  batch.update(seatRef, {
    status: newStatus,
    groupId: newStatus === "available" ? null : seat.groupId,
    updatedAt: serverTimestamp(),
  });

  const logRef = doc(collection(db, "operation_logs"));
  batch.set(logRef, {
    seatId: seat.id,
    previousStatus: seat.status,
    newStatus,
    groupId: seat.groupId || null,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * 指定グループの全座席をavailableに戻す（誤登録の取消）
 */
export async function cancelGroup(
  seats: Seat[],
  groupId: string
): Promise<void> {
  const groupSeats = seats.filter((s) => s.groupId === groupId);
  if (groupSeats.length === 0) return;

  const batch = writeBatch(db);

  for (const seat of groupSeats) {
    const seatRef = doc(db, "seats", seat.id);
    batch.update(seatRef, {
      status: "available" as SeatStatus,
      groupId: null,
      updatedAt: serverTimestamp(),
    });

    const logRef = doc(collection(db, "operation_logs"));
    batch.set(logRef, {
      seatId: seat.id,
      previousStatus: seat.status,
      newStatus: "available",
      groupId,
      timestamp: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * 全座席をavailableにリセット（レイアウトは維持）
 */
export async function resetAllSeats(seats: Seat[]): Promise<number> {
  const toReset = seats.filter(
    (s) => s.type === "normal" && s.status !== "available"
  );
  if (toReset.length === 0) return 0;

  for (let i = 0; i < toReset.length; i += 250) {
    const chunk = toReset.slice(i, i + 250);
    const batch = writeBatch(db);
    for (const seat of chunk) {
      batch.update(doc(db, "seats", seat.id), {
        status: "available" as SeatStatus,
        groupId: null,
        updatedAt: serverTimestamp(),
      });
      const logRef = doc(collection(db, "operation_logs"));
      batch.set(logRef, {
        seatId: seat.id,
        previousStatus: seat.status,
        newStatus: "available",
        groupId: seat.groupId || null,
        timestamp: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return toReset.length;
}

/**
 * 操作ログを全件削除する
 */
export async function clearLogs(): Promise<number> {
  const snapshot = await getDocs(collection(db, "operation_logs"));
  if (snapshot.empty) return 0;

  const total = snapshot.size;
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const chunk = snapshot.docs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return total;
}

export interface SeatConfig {
  id: string;
  row: string;
  col: number;
  block: Block;
  type: SeatType;
}

/**
 * 既存の全座席を削除し、新しいレイアウトで再作成する
 */
export async function saveLayout(seatConfigs: SeatConfig[]): Promise<void> {
  // 既存のseatsを全削除
  const existing = await getDocs(collection(db, "seats"));
  const deleteBatch = writeBatch(db);
  existing.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  // 新しい座席を作成 (writeBatchは500件まで)
  for (let i = 0; i < seatConfigs.length; i += 250) {
    const chunk = seatConfigs.slice(i, i + 250);
    const batch = writeBatch(db);
    for (const cfg of chunk) {
      const seatRef = doc(db, "seats", cfg.id);
      batch.set(seatRef, {
        row: cfg.row,
        col: cfg.col,
        block: cfg.block,
        type: cfg.type,
        status: "available" as SeatStatus,
        groupId: null,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

// ─── ピークモード関連 ───

const appStateRef = () => doc(db, "app_state", "current");

/**
 * ピークモードを切り替える
 * ON時はセッションカウンターをリセット
 */
export async function togglePeakMode(currentValue: boolean): Promise<void> {
  const newValue = !currentValue;
  const data: Record<string, unknown> = {
    peakMode: newValue,
    updatedAt: serverTimestamp(),
  };
  if (newValue) {
    data.peakConsumedCount = 0;
    data.peakMarkedCount = 0;
  }
  await setDoc(appStateRef(), data, { merge: true });
}

/**
 * キューに人数を追加（fire-and-forget用）
 */
export async function addToQueue(count: number): Promise<void> {
  await addDoc(collection(db, "queue"), {
    count,
    timestamp: serverTimestamp(),
    status: "pending",
  });
}

/**
 * キューアイテムを消化済みにし、消化カウンターを加算
 */
export async function consumeQueueItem(
  itemId: string,
  count: number
): Promise<void> {
  const batch = writeBatch(db);

  batch.update(doc(db, "queue", itemId), {
    status: "consumed",
    consumedAt: serverTimestamp(),
  });

  batch.update(appStateRef(), {
    peakConsumedCount: increment(count),
  });

  await batch.commit();
}

/**
 * 座席を直接 available → seated にマークし、マークカウンターを加算
 */
export async function markSeatsAsSeated(
  seats: Seat[],
  seatIds: string[]
): Promise<void> {
  const toMark = seatIds
    .map((id) => seats.find((s) => s.id === id))
    .filter((s): s is Seat => !!s && s.status === "available");

  if (toMark.length === 0) return;

  for (let i = 0; i < toMark.length; i += 250) {
    const chunk = toMark.slice(i, i + 250);
    const batch = writeBatch(db);

    for (const seat of chunk) {
      batch.update(doc(db, "seats", seat.id), {
        status: "seated" as SeatStatus,
        groupId: null,
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(collection(db, "operation_logs"));
      batch.set(logRef, {
        seatId: seat.id,
        previousStatus: seat.status,
        newStatus: "seated",
        groupId: null,
        timestamp: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  await updateDoc(appStateRef(), {
    peakMarkedCount: increment(toMark.length),
  });
}

/**
 * キューを全件削除する
 */
export async function clearQueue(): Promise<number> {
  const snapshot = await getDocs(collection(db, "queue"));
  if (snapshot.empty) return 0;

  const total = snapshot.size;
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const chunk = snapshot.docs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return total;
}
