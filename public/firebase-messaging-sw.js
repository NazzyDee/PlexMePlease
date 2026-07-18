importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDftUpjVWSDQS7sQ2V295XJecFoP7tk7Qk",
  authDomain: "your-journey-your-tools.firebaseapp.com",
  projectId: "your-journey-your-tools",
  storageBucket: "your-journey-your-tools.firebasestorage.app",
  messagingSenderId: "547110387626",
  appId: "1:547110387626:web:25e3ade04ad02ed92935d3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
