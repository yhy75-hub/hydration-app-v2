importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAX1QmJoIVN67GKMoXV1oIbNmV1bk-E2aM',
  authDomain: 'hydration-850bd.firebaseapp.com',
  projectId: 'hydration-850bd',
  storageBucket: 'hydration-850bd.firebasestorage.app',
  messagingSenderId: '385339912693',
  appId: '1:385339912693:web:4db23ab0e1e6f8c35630bc'
});

const messaging = firebase.messaging();

const APP_URL = '/hydration-app-v2/';

messaging.onBackgroundMessage(payload => {
  if (payload.notification) return;
  const title = (payload.data && payload.data.title) || '水分補給リマインダー';
  const body  = (payload.data && payload.data.body)  || 'チェックしてね';
  self.registration.showNotification(title, {
    body,
    icon: '/hydration-app-v2/icons/icon-192.png',
    badge: '/hydration-app-v2/icons/icon-192.png',
    tag: 'hydration',
    renotify: true,
    data: { url: APP_URL }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || APP_URL;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(APP_URL));
      return existing ? existing.focus() : clients.openWindow(targetUrl);
    })
  );
});
