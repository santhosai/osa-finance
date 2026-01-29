import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD86J7zpRnOnYc-qbnomaLQ5UXIg3yo5Y0",
  authDomain: "financetracker-ba33d.firebaseapp.com",
  projectId: "financetracker-ba33d",
  storageBucket: "financetracker-ba33d.firebasestorage.app",
  messagingSenderId: "169670892813",
  appId: "1:169670892813:web:7368ce106f78ab22b0a444",
  measurementId: "G-NY9JF2RBYQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

export default app;
