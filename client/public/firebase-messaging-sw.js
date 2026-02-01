// Firebase Cloud Messaging Service Worker
// This handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyD86J7zpRnOnYc-qbnomaLQ5UXIg3yo5Y0",
  authDomain: "financetracker-ba33d.firebaseapp.com",
  projectId: "financetracker-ba33d",
  storageBucket: "financetracker-ba33d.firebasestorage.app",
  messagingSenderId: "169670892813",
  appId: "1:169670892813:web:7368ce106f78ab22b0a444",
  measurementId: "G-NY9JF2RBYQ"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Payment Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New payment received',
    icon: '/murugan.png',
    badge: '/murugan.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'payment-notification',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: payload.data?.url || '/',
      paymentId: payload.data?.paymentId,
      customerName: payload.data?.customerName,
      amount: payload.data?.amount
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Check if app is already open
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: event.notification.data
              });
              return client.focus();
            }
          }
          // Open new window if not open
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded');
