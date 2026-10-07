"""
PlexMePlease Media Bridge
Watches Google Cloud Firestore (Project: your-journey-your-tools) in real time
for incoming media requests from PlexMePlease and forwards them directly to
local Radarr (movies) and Sonarr (TV shows) APIs.
"""

import os
import re
import time
import requests
import firebase_admin
from firebase_admin import credentials, firestore

# ================= CONFIGURATION =================
# Set these or configure environment variables
RADARR_URL = os.getenv("RADARR_URL", "http://localhost:7878")
RADARR_API_KEY = os.getenv("RADARR_API_KEY", "YOUR_RADARR_API_KEY")
RADARR_ROOT_FOLDER = os.getenv("RADARR_ROOT_FOLDER", "C:\\PlexMedia\\Movies")
RADARR_QUALITY_PROFILE_ID = int(os.getenv("RADARR_QUALITY_PROFILE_ID", 1))

SONARR_URL = os.getenv("SONARR_URL", "http://localhost:8989")
SONARR_API_KEY = os.getenv("SONARR_API_KEY", "YOUR_SONARR_API_KEY")
SONARR_ROOT_FOLDER = os.getenv("SONARR_ROOT_FOLDER", "C:\\PlexMedia\\TV Shows")
SONARR_QUALITY_PROFILE_ID = int(os.getenv("SONARR_QUALITY_PROFILE_ID", 1))

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "your-journey-your-tools")
CREDENTIALS_FILE = os.getenv("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
# =================================================

def init_firebase():
    if os.path.exists(CREDENTIALS_FILE):
        cred = credentials.Certificate(CREDENTIALS_FILE)
        firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
    else:
        # Fallback to Application Default Credentials (ADC) or project init
        print(f"Warning: {CREDENTIALS_FILE} not found. Attempting Application Default Credentials.")
        firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
    return firestore.client()

def parse_request_details(doc_data):
    """Extracts title, year, and media type from fields or parsed message."""
    title = doc_data.get("mediaTitle")
    year = doc_data.get("releaseYear")
    media_type = doc_data.get("mediaType")

    if not title:
        message = doc_data.get("message", "")
        pattern = r"New Request from (?:.*?):\s*(.*?)(?:\s*\((\d{4})\))?\s*\[(movie|tv)\]"
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            year = int(match.group(2)) if match.group(2) else None
            media_type = match.group(3).lower()

    return title, year, media_type

def add_to_radarr(title, year):
    """Searches Radarr lookup and adds the movie."""
    try:
        res = requests.get(
            f"{RADARR_URL}/api/v3/movie/lookup",
            params={"term": title},
            headers={"X-Api-Key": RADARR_API_KEY},
            timeout=10
        )
        if res.status_code != 200 or not res.json():
            print(f"[Radarr] Could not find movie matching: '{title}'")
            return False

        results = res.json()
        movie = results[0]
        if year:
            for item in results:
                if item.get("year") == int(year):
                    movie = item
                    break

        payload = {
            "title": movie["title"],
            "qualityProfileId": RADARR_QUALITY_PROFILE_ID,
            "titleSlug": movie.get("titleSlug"),
            "tmdbId": movie.get("tmdbId"),
            "year": movie.get("year"),
            "rootFolderPath": RADARR_ROOT_FOLDER,
            "monitored": True,
            "addOptions": {
                "searchForMovie": True
            }
        }
        add_res = requests.post(
            f"{RADARR_URL}/api/v3/movie",
            json=payload,
            headers={"X-Api-Key": RADARR_API_KEY},
            timeout=10
        )
        if add_res.status_code in [200, 201]:
            print(f"[Radarr] Successfully added movie: {movie['title']} ({movie.get('year')})")
            return True
        else:
            print(f"[Radarr] Error adding movie ({add_res.status_code}): {add_res.text}")
            return False
    except Exception as e:
        print(f"[Radarr] Network/API error: {e}")
        return False

def add_to_sonarr(title, year):
    """Searches Sonarr lookup and adds the TV series."""
    try:
        res = requests.get(
            f"{SONARR_URL}/api/v3/series/lookup",
            params={"term": title},
            headers={"X-Api-Key": SONARR_API_KEY},
            timeout=10
        )
        if res.status_code != 200 or not res.json():
            print(f"[Sonarr] Could not find series matching: '{title}'")
            return False

        series = res.json()[0]
        payload = {
            "title": series["title"],
            "qualityProfileId": SONARR_QUALITY_PROFILE_ID,
            "titleSlug": series.get("titleSlug"),
            "tvdbId": series.get("tvdbId"),
            "year": series.get("year"),
            "rootFolderPath": SONARR_ROOT_FOLDER,
            "monitored": True,
            "seasonFolder": True,
            "addOptions": {
                "searchForMissingEpisodes": True
            }
        }
        add_res = requests.post(
            f"{SONARR_URL}/api/v3/series",
            json=payload,
            headers={"X-Api-Key": SONARR_API_KEY},
            timeout=10
        )
        if add_res.status_code in [200, 201]:
            print(f"[Sonarr] Successfully added series: {series['title']}")
            return True
        else:
            print(f"[Sonarr] Error adding series ({add_res.status_code}): {add_res.text}")
            return False
    except Exception as e:
        print(f"[Sonarr] Network/API error: {e}")
        return False

def on_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name in ["ADDED", "MODIFIED"]:
            doc = change.document
            data = doc.to_dict()

            if data.get("app") == "PlexMePlease" and data.get("status") == "unresolved":
                requester = data.get("user", "Anonymous")
                title, year, media_type = parse_request_details(data)

                if not title:
                    continue

                year_str = f" ({year})" if year else ""
                print(f"\n[Incoming Request] {title}{year_str} [{media_type}] requested by {requester}")

                success = False
                target_service = "Unknown"
                if media_type == "movie":
                    target_service = "Radarr"
                    success = add_to_radarr(title, year)
                elif media_type in ["tv", "show", "series"]:
                    target_service = "Sonarr"
                    success = add_to_sonarr(title, year)

                if success:
                    doc.reference.update({
                        "status": "resolved",
                        "resolutionNotes": f"Automatically dispatched to {target_service}"
                    })
                    print(f"[Success] Request marked as resolved in Firestore.")

def main():
    db = init_firebase()
    print("==================================================")
    print(" PlexMePlease Automated Media Server Bridge")
    print(" Watching Firestore collection: 'feedback'")
    print("==================================================")

    query = db.collection("feedback").where("app", "==", "PlexMePlease").where("status", "==", "unresolved")
    query.on_snapshot(on_snapshot)

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down bridge listener.")
            break

if __name__ == "__main__":
    main()
