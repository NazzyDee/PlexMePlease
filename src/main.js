import { registerSW } from 'virtual:pwa-register';

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

// IMPORTANT: Replace this with the actual Webhook URL from the other app
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE'; 

const form = document.getElementById('request-form');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const loader = submitBtn.querySelector('.loader');
const statusMessage = document.getElementById('statusMessage');

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
  
  const payload = {
    content: `New Request from ${friendName}: ${mediaTitle} (${mediaType})`,
    friendName,
    mediaTitle,
    mediaType,
    timestamp: new Date().toISOString()
  };

  // Set loading state
  submitBtn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    // If webhook is not set up, simulate a delay
    if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Simulated Webhook Payload:', payload);
      showStatus('Success! (Simulated, as webhook URL is not set)', 'success');
      form.reset();
      return;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    showStatus('Request sent successfully!', 'success');
    form.reset();
    
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
