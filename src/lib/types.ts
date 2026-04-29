import { Timestamp } from "firebase/firestore";

export type SeatStatus = "available" | "waiting" | "guiding" | "seated";
export type SeatType = "normal" | "equipment";
export type Block = "front" | "center" | "back";

export interface Seat {
  id: string;
  row: string;
  col: number;
  block: Block;
  type: SeatType;
  status: SeatStatus;
  groupId: string | null;
  updatedAt: Timestamp;
}

export interface OperationLog {
  seatId: string;
  previousStatus: SeatStatus;
  newStatus: SeatStatus;
  timestamp: Timestamp;
  groupId?: string;
}
