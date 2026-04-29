import { initializeApp } from "firebase/app";
import { getFirestore, doc, writeBatch, serverTimestamp } from "firebase/firestore";

// TODO: firebase.ts と同じ設定値に置き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyBBaPpfgBdViqGIbwDwrk1Qh7A-oNcmbio",
  authDomain: "seatmanagemantsystem.firebaseapp.com",
  projectId: "seatmanagemantsystem",
  storageBucket: "seatmanagemantsystem.firebasestorage.app",
  messagingSenderId: "787885754532",
  appId: "1:787885754532:web:a7bb161f0dde176bc6be31",
  measurementId: "G-SJD5WHPCHR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 座席レイアウト設定
const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLS = 10;

// 行からブロックを判定
function getBlock(row: string): "front" | "center" | "back" {
  if (["A", "B", "C"].includes(row)) return "front";
  if (["D", "E", "F", "G"].includes(row)) return "center";
  return "back";
}

// 機材配置席 (案内不可)
const EQUIPMENT_SEATS = new Set(["E-5", "E-6", "H-5", "H-6"]);

async function seed() {
  console.log("Seeding seats...");

  const batch = writeBatch(db);
  let count = 0;

  for (const row of ROWS) {
    for (let col = 1; col <= COLS; col++) {
      const id = `${row}-${col}`;
      const seatRef = doc(db, "seats", id);

      batch.set(seatRef, {
        row,
        col,
        block: getBlock(row),
        type: EQUIPMENT_SEATS.has(id) ? "equipment" : "normal",
        status: "available",
        groupId: null,
        updatedAt: serverTimestamp(),
      });

      count++;
    }
  }

  await batch.commit();
  console.log(`Done! Seeded ${count} seats.`);
}

seed().catch(console.error);
