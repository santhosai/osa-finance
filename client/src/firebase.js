import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

// VAPID key for FCM (from Firebase Console -> Cloud Messaging -> Web Push certificates)
const VAPID_KEY = 'BCAAgvRDjPv3sMxOy-9dFfgk9xsKQnJxwhNLXKhMv6hLeZVloFVYsTDoLxq-hsBUMEe-2jidTGgN2TUZHi8S7jg';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.log('FCM not supported in this browser');
}

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) {
      console.log('FCM not available');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

export { messaging };
export default app;
