import { registerSW } from 'virtual:pwa-register';
import { db, auth, messaging } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, setDoc, doc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
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

// Tab Switching Logic
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    // Remove active class from all nav items and views
    navItems.forEach(nav => nav.classList.remove('active'));
    views.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
    });

    // Add active class to clicked nav item
    item.classList.add('active');
    
    // Show corresponding view
    const targetId = item.getAttribute('data-target');
    const targetView = document.getElementById(targetId);
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  });
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBroadcastItem(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  // Skip broadcasts targeted at other apps
  if (data.app && data.app !== 'All Apps' && data.app !== 'PlexMePlease') {
    return null;
  }

  if (data.expiresAt) {
    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate().getTime() : data.expiresAt;
    if (Date.now() > expiresAt) {
      return null; // skip expired
    }
  }

  const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const item = document.createElement('div');
  item.className = 'message-item' + (data.category === 'poll' ? ' poll-card' : '');
  item.setAttribute('data-broadcast-id', id);

  if (data.category === 'poll' && Array.isArray(data.pollOptions) && data.pollOptions.length > 0) {
    const voteKey = 'pmp_poll_vote_' + id;
    let storedVote = null;
    try {
      const raw = localStorage.getItem(voteKey);
      if (raw) storedVote = JSON.parse(raw);
    } catch {
      const raw = localStorage.getItem(voteKey);
      if (raw) storedVote = { selectedOption: raw };
    }

    if (storedVote && storedVote.selectedOption) {
      // Locked-in voted state - private results, only show thanks message
      item.innerHTML = `
        <div class="message-header">
          <div class="poll-header-title">
            <span class="poll-badge">📊 Poll</span>
            <span class="message-title">${escapeHtml(data.title)}</span>
          </div>
          <span class="message-time">${dateObj.toLocaleDateString()}</span>
        </div>
        ${data.body ? `<div class="message-body">${escapeHtml(data.body)}</div>` : ''}
        <div class="poll-locked-options">
          ${data.pollOptions.map(opt => {
            const isChosen = opt.trim().toLowerCase() === storedVote.selectedOption.trim().toLowerCase();
            return `
              <div class="poll-locked-option ${isChosen ? 'chosen' : ''}">
                <span class="poll-option-check">${isChosen ? '✓' : '○'}</span>
                <span class="poll-option-label-text">${escapeHtml(opt)}</span>
                ${isChosen ? '<span class="poll-chosen-tag">Your Vote</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
        <div class="poll-feedback-banner">
          <span class="poll-feedback-icon">✓</span>
          <div class="poll-feedback-text">
            <strong>Thanks for the feedback!</strong>
            <span>Your vote is locked in.</span>
          </div>
        </div>
      `;
    } else {
      // Active voting state
      const savedName = localStorage.getItem('plexMePleaseName') || '';
      item.innerHTML = `
        <div class="message-header">
          <div class="poll-header-title">
            <span class="poll-badge">📊 Poll</span>
            <span class="message-title">${escapeHtml(data.title)}</span>
          </div>
          <span class="message-time">${dateObj.toLocaleDateString()}</span>
        </div>
        ${data.body ? `<div class="message-body">${escapeHtml(data.body)}</div>` : ''}
        <form class="poll-vote-form" data-poll-id="${id}">
          <div class="poll-options-list">
            ${data.pollOptions.map((opt, optIdx) => `
              <label class="poll-option-label" for="poll_opt_${id}_${optIdx}">
                <input 
                  type="radio" 
                  id="poll_opt_${id}_${optIdx}" 
                  name="poll_option_${id}" 
                  value="${escapeHtml(opt)}" 
                  class="poll-radio" 
                  required
                />
                <div class="poll-option-card">
                  <span class="poll-custom-radio"></span>
                  <span class="poll-option-name">${escapeHtml(opt)}</span>
                </div>
              </label>
            `).join('')}
          </div>

          <div class="poll-voter-input-wrap">
            <label class="poll-voter-label" for="voter_name_${id}">Your Name</label>
            <input 
              type="text" 
              id="voter_name_${id}" 
              name="voterName" 
              class="poll-voter-input" 
              placeholder="e.g. John Doe" 
              value="${escapeHtml(savedName)}" 
              required
            />
          </div>

          <button type="submit" class="poll-submit-btn">
            <span class="btn-text">Submit Vote</span>
            <span class="loader hidden"></span>
          </button>

          <div class="status-message hidden poll-status"></div>
        </form>
      `;

      // Attach submit listener
      const pollForm = item.querySelector('.poll-vote-form');
      pollForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusBox = pollForm.querySelector('.poll-status');
        const submitBtn = pollForm.querySelector('.poll-submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');

        statusBox.className = 'status-message hidden poll-status';
        statusBox.textContent = '';

        const formData = new FormData(pollForm);
        const selectedOption = formData.get(`poll_option_${id}`);
        const voterName = (formData.get('voterName') || '').trim();

        if (!selectedOption) {
          statusBox.textContent = 'Please choose an option to vote.';
          statusBox.className = 'status-message error poll-status';
          return;
        }

        if (!voterName) {
          statusBox.textContent = 'Please enter your name.';
          statusBox.className = 'status-message error poll-status';
          return;
        }

        // Save name for PlexMePlease session & forms
        localStorage.setItem('plexMePleaseName', voterName);
        const fnInput = document.getElementById('friendName');
        if (fnInput) fnInput.value = voterName;
        const snInput = document.getElementById('senderName');
        if (snInput) snInput.value = voterName;

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');

        try {
          const payload = {
            app: 'PlexMePlease',
            type: 'poll_vote',
            status: 'unresolved',
            pollId: id,
            pollTitle: data.title,
            selectedOption: selectedOption,
            user: voterName,
            sender: voterName,
            message: `📊 Poll Vote from ${voterName}: "${selectedOption}" (Poll: "${data.title}")`,
            createdAt: serverTimestamp(),
            priority: 'Normal'
          };

          await addDoc(collection(db, 'feedback'), payload);

          // Lock in vote locally in localStorage
          localStorage.setItem(voteKey, JSON.stringify({
            selectedOption: selectedOption,
            votedAt: Date.now()
          }));

          // Replace with locked item immediately
          const newItem = renderBroadcastItem(docSnap);
          if (newItem) {
            item.replaceWith(newItem);
          }
        } catch (err) {
          console.error('Error submitting vote:', err);
          statusBox.textContent = 'Failed to submit vote. Please try again.';
          statusBox.className = 'status-message error poll-status';
          submitBtn.disabled = false;
          btnText.classList.remove('hidden');
          loader.classList.add('hidden');
        }
      });
    }
  } else {
    // Standard broadcast message
    item.innerHTML = `
      <div class="message-header">
        <span class="message-title">${escapeHtml(data.title)}</span>
        <span class="message-time">${dateObj.toLocaleDateString()}</span>
      </div>
      <div class="message-body">${escapeHtml(data.body)}</div>
      ${data.actionUrl ? `
        <a href="${escapeHtml(data.actionUrl)}" target="_blank" rel="noopener noreferrer" class="broadcast-link-btn">
          Open Link ↗
        </a>
      ` : ''}
    `;
  }

  return item;
}

// Fetch Messages from Firestore
const messagesList = document.getElementById('messages-list');
const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'));
onSnapshot(q, (snapshot) => {
  messagesList.innerHTML = '';
  if (snapshot.empty) {
    messagesList.innerHTML = '<div class="loading-messages">No messages yet.</div>';
    return;
  }
  
  let hasValidMessages = false;
  snapshot.forEach((doc) => {
    const item = renderBroadcastItem(doc);
    if (item) {
      hasValidMessages = true;
      messagesList.appendChild(item);
    }
  });
  
  if (!hasValidMessages) {
    messagesList.innerHTML = '<div class="loading-messages">No messages yet.</div>';
  }
});

// Notification Toggle Logic
const notificationToggle = document.getElementById('notification-toggle');

// Initialize toggle state based on current permission
if (Notification.permission === 'granted') {
  notificationToggle.checked = true;
} else {
  notificationToggle.checked = false;
}

notificationToggle.addEventListener('change', async (e) => {
  if (e.target.checked) {
    // User wants to turn them ON
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await requestNotificationPermission();
    } else {
      // Permission denied by browser, revert toggle
      e.target.checked = false;
      alert('You must enable notifications in your browser settings to receive pushes.');
    }
  } else {
    // User wants to turn them OFF
    try {
      const currentToken = await getToken(messaging, { 
        vapidKey: 'BGGZz1-iAKChm-xiCjsj_Ocq08GeyzYzwuw8msXeDTEG8WqJUNWgCi7YSX079C69U_J-e1cepjluK4hRJe5K2qQ' 
      });
      if (currentToken) {
        await deleteDoc(doc(db, 'fcm_tokens', currentToken));
        console.log('Token deleted from Firestore.');
      }
    } catch (err) {
      console.error('Error removing token:', err);
    }
  }
});


// Load name from cache
const savedName = localStorage.getItem('plexMePleaseName');
if (savedName) {
  const friendNameInput = document.getElementById('friendName');
  if (friendNameInput) friendNameInput.value = savedName;
  
  const senderNameInput = document.getElementById('senderName');
  if (senderNameInput) senderNameInput.value = savedName;
}

// Add media items dynamic functionality
const mediaItemsContainer = document.getElementById('media-items-container');
const addMediaBtn = document.getElementById('addMediaBtn');

function updateMediaItemHeaders() {
  const items = mediaItemsContainer.querySelectorAll('.media-item');
  items.forEach((item, index) => {
    const header = item.querySelector('h4');
    header.textContent = `Request ${index + 1}`;
    
    const removeBtn = item.querySelector('.remove-item-btn');
    if (items.length > 1) {
      removeBtn.classList.remove('hidden');
    } else {
      removeBtn.classList.add('hidden');
    }
  });
}

addMediaBtn.addEventListener('click', () => {
  const items = mediaItemsContainer.querySelectorAll('.media-item');
  const firstItem = items[0];
  const newItem = firstItem.cloneNode(true);
  
  // Clear inputs in cloned item
  newItem.querySelectorAll('input').forEach(input => input.value = '');
  newItem.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
  
  // Add remove event listener
  const removeBtn = newItem.querySelector('.remove-item-btn');
  removeBtn.addEventListener('click', () => {
    newItem.remove();
    updateMediaItemHeaders();
  });
  
  mediaItemsContainer.appendChild(newItem);
  updateMediaItemHeaders();
});

// Need to also bind remove button on the initial first item just in case
const initialRemoveBtn = mediaItemsContainer.querySelector('.remove-item-btn');
initialRemoveBtn.addEventListener('click', (e) => {
  const item = e.target.closest('.media-item');
  item.remove();
  updateMediaItemHeaders();
});

form.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Reset status
  statusMessage.className = 'status-message hidden';
  statusMessage.textContent = '';
  
  // Get form data
  const formData = new FormData(form);
  const friendName = formData.get('friendName');
  
  // Save name to cache
  localStorage.setItem('plexMePleaseName', friendName);
  
  // Set loading state
  submitBtn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    const items = mediaItemsContainer.querySelectorAll('.media-item');
    const promises = Array.from(items).map(item => {
      const mediaTitle = item.querySelector('[name="mediaTitle"]').value;
      const releaseYear = item.querySelector('[name="releaseYear"]').value;
      const mediaType = item.querySelector('[name="mediaType"]').value;

      const yearText = releaseYear ? ` (${releaseYear})` : '';
      const payload = {
        app: 'PlexMePlease',
        type: 'feature_request',
        status: 'unresolved',
        message: `New Request from ${friendName}: ${mediaTitle}${yearText} [${mediaType}]`,
        user: friendName,
        mediaTitle: mediaTitle.trim(),
        releaseYear: releaseYear ? parseInt(releaseYear, 10) : null,
        mediaType: mediaType,
        createdAt: serverTimestamp(),
        priority: 'Normal'
      };

      return addDoc(collection(db, 'feedback'), payload);
    });

    await Promise.all(promises);
    
    showStatus(items.length > 1 ? 'Requests sent successfully!' : 'Request sent successfully!', 'success');
    
    // Reset form, but we also want to remove extra items
    form.reset();
    document.getElementById('friendName').value = friendName; // Restore name
    
    // Remove all but first item
    const currentItems = mediaItemsContainer.querySelectorAll('.media-item');
    for (let i = 1; i < currentItems.length; i++) {
      currentItems[i].remove();
    }
    updateMediaItemHeaders();
    
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

// Handle Send Message Form
const messageForm = document.getElementById('message-form');
if (messageForm) {
  const msgSubmitBtn = document.getElementById('sendMessageBtn');
  const msgBtnText = msgSubmitBtn.querySelector('.btn-text');
  const msgLoader = msgSubmitBtn.querySelector('.loader');
  const messageStatus = document.getElementById('messageStatus');

  messageForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
    }
  });

  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    messageStatus.className = 'status-message hidden';
    messageStatus.textContent = '';
    
    const formData = new FormData(messageForm);
    const senderName = formData.get('senderName');
    const senderContact = formData.get('senderContact');
    const messageText = formData.get('messageText');
    
    if (senderName) {
      localStorage.setItem('plexMePleaseName', senderName);
    }
    
    const payload = {
      app: 'PlexMePlease',
      type: 'direct_message',
      status: 'unread',
      message: messageText,
      senderName: senderName || 'Anonymous',
      senderContact: senderContact || 'No contact provided',
      createdAt: serverTimestamp(),
      priority: 'Normal'
    };

    msgSubmitBtn.disabled = true;
    msgBtnText.classList.add('hidden');
    if (msgLoader) msgLoader.classList.remove('hidden');

    try {
      await addDoc(collection(db, 'feedback'), payload);
      
      messageStatus.textContent = 'Message sent successfully!';
      messageStatus.className = 'status-message success';
      messageForm.reset();
      
      // Restore name if it was saved
      const newSavedName = localStorage.getItem('plexMePleaseName');
      if (newSavedName) {
        document.getElementById('senderName').value = newSavedName;
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      messageStatus.textContent = 'Failed to send message. Please try again.';
      messageStatus.className = 'status-message error';
    } finally {
      msgSubmitBtn.disabled = false;
      msgBtnText.classList.remove('hidden');
      if (msgLoader) msgLoader.classList.add('hidden');
    }
  });
}
