import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwMchsGXzHFjJywx3xyx44nGLNzYFFRNQ",
  authDomain: "fintrack-e10ce.firebaseapp.com",
  projectId: "fintrack-e10ce",
  storageBucket: "fintrack-e10ce.firebasestorage.app",
  messagingSenderId: "26874807625",
  appId: "1:26874807625:web:f0162a11bafc6167218698",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;