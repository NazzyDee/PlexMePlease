import { registerSW } from 'virtual:pwa-register';
import { db, auth, messaging, storage } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, setDoc, doc, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

function switchView(targetId) {
  navItems.forEach(nav => {
    if (nav.getAttribute('data-target') === targetId) {
      nav.classList.add('active');
    } else {
      nav.classList.remove('active');
    }
  });
  views.forEach(view => {
    if (view.id === targetId) {
      view.classList.remove('hidden');
      view.classList.add('active');
    } else {
      view.classList.remove('active');
      view.classList.add('hidden');
    }
  });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.getAttribute('data-target');
    switchView(targetId);
  });
});

const quickReportBtn = document.getElementById('quickReportBtn');
if (quickReportBtn) {
  quickReportBtn.addEventListener('click', () => {
    switchView('view-messages');
    if (typeof setReportMode === 'function') {
      setReportMode('streaming_issue');
    }
    const mediaWatchedInput = document.getElementById('mediaTitleWatched');
    if (mediaWatchedInput) mediaWatchedInput.focus();
  });
}

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

// Mode Tabs & Feedback/Report Handling
const tabStreaming = document.getElementById('tabStreaming');
const tabMessage = document.getElementById('tabMessage');
const headerStreaming = document.getElementById('header-streaming');
const headerMessage = document.getElementById('header-message');
const streamingFields = document.getElementById('streaming-fields');
const reportTypeInput = document.getElementById('reportType');
const messageTextLabel = document.getElementById('messageTextLabel');
const messageText = document.getElementById('messageText');
const sendMessageBtnText = document.getElementById('sendMessageBtnText');
const senderNameRequired = document.getElementById('senderNameRequired');
const senderNameInput = document.getElementById('senderName');

function setReportMode(mode) {
  if (mode === 'streaming_issue') {
    if (tabStreaming) tabStreaming.classList.add('active');
    if (tabMessage) tabMessage.classList.remove('active');
    if (headerStreaming) headerStreaming.classList.remove('hidden');
    if (headerMessage) headerMessage.classList.add('hidden');
    if (streamingFields) streamingFields.classList.remove('hidden');
    if (reportTypeInput) reportTypeInput.value = 'streaming_issue';
    if (messageTextLabel) messageTextLabel.textContent = 'Additional Details';
    if (messageText) messageText.placeholder = 'Describe what happens (e.g. pauses to buffer every 30 seconds, started around 45 min mark...)';
    if (sendMessageBtnText) sendMessageBtnText.textContent = 'Submit Streaming Report';
    if (senderNameRequired) senderNameRequired.textContent = '*';
    if (senderNameInput) senderNameInput.required = true;
  } else {
    if (tabMessage) tabMessage.classList.add('active');
    if (tabStreaming) tabStreaming.classList.remove('active');
    if (headerMessage) headerMessage.classList.remove('hidden');
    if (headerStreaming) headerStreaming.classList.add('hidden');
    if (streamingFields) streamingFields.classList.add('hidden');
    if (reportTypeInput) reportTypeInput.value = 'direct_message';
    if (messageTextLabel) messageTextLabel.textContent = 'Message';
    if (messageText) messageText.placeholder = 'Type your message here...';
    if (sendMessageBtnText) sendMessageBtnText.textContent = 'Send Message';
    if (senderNameRequired) senderNameRequired.textContent = '(Optional)';
    if (senderNameInput) senderNameInput.required = false;
  }
}

if (tabStreaming) {
  tabStreaming.addEventListener('click', () => setReportMode('streaming_issue'));
}
if (tabMessage) {
  tabMessage.addEventListener('click', () => setReportMode('direct_message'));
}

// Screenshot / Image Attachment Handling
const screenshotInput = document.getElementById('screenshotInput');
const uploadDropzone = document.getElementById('uploadDropzone');
const imagePreviewWrapper = document.getElementById('imagePreviewWrapper');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewName = document.getElementById('imagePreviewName');
const imagePreviewSize = document.getElementById('imagePreviewSize');
const removeImageBtn = document.getElementById('removeImageBtn');

let selectedImageFile = null;
let compressedImageData = null;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}

function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob((blob) => {
          resolve({
            dataUrl,
            blob,
            size: blob ? blob.size : dataUrl.length,
            width,
            height
          });
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    selectedImageFile = file;
    compressedImageData = await compressImage(file);
    
    if (imagePreview) imagePreview.src = compressedImageData.dataUrl;
    if (imagePreviewName) imagePreviewName.textContent = file.name || 'screenshot.jpg';
    if (imagePreviewSize) imagePreviewSize.textContent = formatFileSize(compressedImageData.size);
    
    if (uploadDropzone) uploadDropzone.classList.add('hidden');
    if (imagePreviewWrapper) imagePreviewWrapper.classList.remove('hidden');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

function clearAttachedImage() {
  selectedImageFile = null;
  compressedImageData = null;
  if (screenshotInput) screenshotInput.value = '';
  if (imagePreview) imagePreview.src = '';
  if (uploadDropzone) uploadDropzone.classList.remove('hidden');
  if (imagePreviewWrapper) imagePreviewWrapper.classList.add('hidden');
}

if (uploadDropzone && screenshotInput) {
  uploadDropzone.addEventListener('click', () => screenshotInput.click());
  uploadDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      screenshotInput.click();
    }
  });

  screenshotInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Drag and drop
  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });

  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
  });

  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener('click', clearAttachedImage);
}

// Paste support (Ctrl+V)
window.addEventListener('paste', (e) => {
  const messagesView = document.getElementById('view-messages');
  if (!messagesView || !messagesView.classList.contains('active')) return;
  
  if (e.clipboardData && e.clipboardData.items) {
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
          break;
        }
      }
    }
  }
});

// Handle Send Message / Streaming Issue Form
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
    const reportType = formData.get('reportType') || 'streaming_issue';
    const senderName = (formData.get('senderName') || '').trim();
    const senderContact = (formData.get('senderContact') || '').trim();
    const messageContent = (formData.get('messageText') || '').trim();
    
    if (senderName) {
      localStorage.setItem('plexMePleaseName', senderName);
      const friendNameInput = document.getElementById('friendName');
      if (friendNameInput) friendNameInput.value = senderName;
    }

    if (reportType === 'streaming_issue' && !senderName) {
      messageStatus.textContent = 'Please enter your name so the admin knows who is experiencing playback issues.';
      messageStatus.className = 'status-message error';
      return;
    }

    msgSubmitBtn.disabled = true;
    msgBtnText.classList.add('hidden');
    if (msgLoader) msgLoader.classList.remove('hidden');

    try {
      // Upload image if attached
      let uploadedImageUrl = null;
      if (compressedImageData) {
        const filename = `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
        try {
          if (storage) {
            const storageRef = ref(storage, `feedback_attachments/${filename}`);
            const snapshot = await uploadBytes(storageRef, compressedImageData.blob, {
              contentType: 'image/jpeg'
            });
            uploadedImageUrl = await getDownloadURL(snapshot.ref);
          }
        } catch (uploadErr) {
          console.warn('Firebase Storage upload failed or restricted, falling back to embedded data URL:', uploadErr);
        }

        // Fallback to compressed base64 dataUrl if storage was not used or failed
        if (!uploadedImageUrl && compressedImageData.dataUrl) {
          uploadedImageUrl = compressedImageData.dataUrl;
        }
      }

      let payload;
      if (reportType === 'streaming_issue') {
        const issueCategory = formData.get('issueCategory') || 'Buffering / Lag';
        const mediaTitleWatched = (formData.get('mediaTitleWatched') || '').trim();
        const devicePlatform = formData.get('devicePlatform') || 'Not specified';
        const networkConnection = formData.get('networkConnection') || 'Not specified';

        payload = {
          app: 'PlexMePlease',
          type: 'streaming_issue',
          status: 'unresolved',
          priority: 'high',
          user: senderName,
          sender: senderName,
          senderName: senderName,
          senderContact: senderContact || 'No contact provided',
          issueCategory: issueCategory,
          mediaTitle: mediaTitleWatched,
          device: devicePlatform,
          connection: networkConnection,
          details: messageContent,
          imageUrl: uploadedImageUrl || null,
          hasAttachment: Boolean(uploadedImageUrl),
          message: `📶 [Streaming Issue: ${issueCategory}] ${mediaTitleWatched ? `Watched: "${mediaTitleWatched}" | ` : ''}Device: ${devicePlatform} (${networkConnection}) | Details: ${messageContent}${uploadedImageUrl ? ' 📷 [Screenshot Attached]' : ''}`,
          createdAt: serverTimestamp()
        };
      } else {
        payload = {
          app: 'PlexMePlease',
          type: 'direct_message',
          status: 'unread',
          priority: 'Normal',
          message: messageContent + (uploadedImageUrl ? ' 📷 [Screenshot Attached]' : ''),
          details: messageContent,
          imageUrl: uploadedImageUrl || null,
          hasAttachment: Boolean(uploadedImageUrl),
          user: senderName || 'Anonymous',
          sender: senderName || 'Anonymous',
          senderName: senderName || 'Anonymous',
          senderContact: senderContact || 'No contact provided',
          createdAt: serverTimestamp()
        };
      }

      await addDoc(collection(db, 'feedback'), payload);
      
      const successMsg = reportType === 'streaming_issue'
        ? (uploadedImageUrl ? 'Streaming issue and screenshot submitted! Admin notified.' : 'Streaming issue report submitted! Admin notified.')
        : 'Message sent successfully!';

      messageStatus.textContent = successMsg;
      messageStatus.className = 'status-message success';
      messageForm.reset();
      clearAttachedImage();
      
      // Keep mode intact and restore saved name
      if (reportTypeInput) reportTypeInput.value = reportType;
      setReportMode(reportType);
      
      const currentSavedName = localStorage.getItem('plexMePleaseName');
      if (currentSavedName && senderNameInput) {
        senderNameInput.value = currentSavedName;
      }
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      messageStatus.textContent = 'Failed to submit report. Please check your connection and try again.';
      messageStatus.className = 'status-message error';
    } finally {
      msgSubmitBtn.disabled = false;
      msgBtnText.classList.remove('hidden');
      if (msgLoader) msgLoader.classList.add('hidden');
    }
  });
}
