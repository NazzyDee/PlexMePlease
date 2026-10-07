# PlexMePlease

PlexMePlease is a Progressive Web App (PWA) allowing friends and family to easily request Movies and TV Shows for your Plex Media Server.

## Features
- **PWA & Mobile-First**: Installable on iOS/Android or directly via desktop browser.
- **Multi-Item Submissions**: Submit multiple movies or series in a single request.
- **Firebase Firestore Backend**: Real-time persistence and anonymous authentication.
- **Automated Media Bridge**: Connects directly to Radarr & Sonarr on your local media server.

## Media Server Integration (Radarr / Sonarr)
Incoming requests are saved to Firestore in the `feedback` collection with `app: 'PlexMePlease'` and `status: 'unresolved'`.

### Running the Media Bridge
To automatically download requested media:
1. Navigate to `scripts/`:
   ```bash
   cd scripts
   pip install firebase-admin requests
   ```
2. Place your Firebase service account key in the folder as `serviceAccountKey.json`.
3. Configure your Radarr / Sonarr URLs and API keys in `plex_bridge.py` or via environment variables:
   ```bash
   export RADARR_API_KEY="your-api-key"
   export SONARR_API_KEY="your-api-key"
   python plex_bridge.py
   ```
4. New requests will be picked up in real-time, sent to Radarr/Sonarr, and marked as `resolved`.

## Development
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
```
