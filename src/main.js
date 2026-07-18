import { registerSW } from 'virtual:pwa-register';
import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to user to refresh the page
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
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
