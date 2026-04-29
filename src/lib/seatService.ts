import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
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
