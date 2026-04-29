import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Firebase Console から取得した設定値に置き換えてください
// https://console.firebase.google.com/ → プロジェクト設定 → ウェブアプリ
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
export const db = getFirestore(app);
