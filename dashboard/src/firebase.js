import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAyktnDOygd6SFq7pXEvDnU-PTCaf4cmLY",
  authDomain: "tugas-besar-ltka-a29d4.firebaseapp.com",
  projectId: "tugas-besar-ltka-a29d4",
  storageBucket: "tugas-besar-ltka-a29d4.firebasestorage.app",
  messagingSenderId: "1045005913293",
  appId: "1:1045005913293:web:d053c9008f20f86b7aad84"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);