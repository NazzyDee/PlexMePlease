import { registerSW } from 'virtual:pwa-register';
import { db, auth, messaging } from './firebase.js';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';

// Authenticate anonymously on load
signInAnonymously(auth).catch(console.error);

// Request Push Notification Permission
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, { 
        vapidKey: 'BGGZz1-iAKChm-xiCjsj_Ocq08GeyzYzwuw8msXeDTEG8WqJUNWgCi7YSX079C69U_J-e1cepjluK4hRJe5K2qQ' 
      });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        // Save token to Firestore
        await setDoc(doc(db, 'fcm_tokens', currentToken), {
          token: currentToken,
          app: 'PlexMePlease',
          createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        console.log('No registration token available.');
      }
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
  }
}

// Handle foreground messages
onMessage(messaging, (payload) => {
  console.log('Message received. ', payload);
  // Optionally show a toast notification here
});

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
});

// Attach permission request to a button or user action
// For PlexMePlease, we can request it when they click the input or on page load
document.addEventListener('DOMContentLoaded', () => {
  // Let's create a subtle notification bell or just request on first click
});



const form = document.getElementById('request-form');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const loader = submitBtn.querySelector('.loader');
const statusMessage = document.getElementById('statusMessage');

// Load name from cache
const savedName = localStorage.getItem('plexReqName');
if (savedName) {
  document.getElementById('friendName').value = savedName;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ask for notification permission if not already granted
  requestNotificationPermission();

  // Reset status
  statusMessage.className = 'status-message hidden';
  statusMessage.textContent = '';
  
  // Get form data
  const formData = new FormData(form);
  const friendName = formData.get('friendName');
  const mediaTitle = formData.get('mediaTitle');
  const mediaType = formData.get('mediaType');
  const releaseYear = formData.get('releaseYear');
  
  // Save name to cache
  localStorage.setItem('plexReqName', friendName);
  
  const yearText = releaseYear ? ` (${releaseYear})` : '';
  const payload = {
    app: 'PlexMePlease',
    type: 'feature_request',
    status: 'unresolved',
    message: `New Request from ${friendName}: ${mediaTitle}${yearText} [${mediaType}]`,
    user: friendName,
    createdAt: serverTimestamp(),
    priority: 'Normal'
  };

  // Set loading state
  submitBtn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    const docRef = await addDoc(collection(db, 'feedback'), payload);
    console.log("Document written with ID: ", docRef.id);
    
    showStatus('Request sent successfully!', 'success');
    form.reset();
    document.getElementById('friendName').value = friendName; // Restore name
    
  } catch (error) {
    console.error('Error sending request:', error);
    showStatus('Failed to send request. Please try again.', 'error');
  } finally {
    // Reset loading state
    submitBtn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
});

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}
