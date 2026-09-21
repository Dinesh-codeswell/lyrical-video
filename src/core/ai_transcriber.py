import requests
import time
import os
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

BASE_URL = "https://api.assemblyai.com/v2"

def get_assemblyai_key(override_key: str | None = None) -> str:
    """Resolve AssemblyAI API key from override, environment, or .env file."""
    # 1. Override key passed directly from request header / UI
    if override_key and override_key.strip():
        return override_key.strip().strip('"').strip("'")
    
    # 2. Environment variable (e.g. from Railway dashboard)
    env_key = os.getenv("ASSEMBLYAI_API_KEY", "").strip().strip('"').strip("'")
    if env_key:
        return env_key
        
    raise ValueError(
        "AssemblyAI API key is missing. Please set ASSEMBLYAI_API_KEY in Railway environment variables, or enter it in the Web Studio settings."
    )

def transcribe_audio(audio_path: Path, api_key: str | None = None) -> List[Dict[str, Any]]:
    """
    Sends audio to AssemblyAI, polls for result, and returns word-level timestamps.
    """
    token = get_assemblyai_key(api_key)
    headers = {"authorization": token}

    # 1. Upload the file
    print(f"Uploading {audio_path.name} to AssemblyAI...")
    with open(audio_path, "rb") as f:
        try:
            response = requests.post(f"{BASE_URL}/upload", headers=headers, data=f, timeout=60)
        except Exception as exc:
            raise ValueError(f"Failed to connect to AssemblyAI upload service: {exc}")
    
    if response.status_code != 200:
        try:
            err_json = response.json()
            err_msg = err_json.get("error") or err_json.get("message") or response.text
        except Exception:
            err_msg = response.text
        raise ValueError(f"AssemblyAI Upload failed ({response.status_code}): {err_msg}")
    
    upload_data = response.json()
    upload_url = upload_data.get("upload_url")
    if not upload_url:
        raise ValueError(f"AssemblyAI response did not contain upload_url: {upload_data}")

    # 2. Request transcription
    print("Requesting transcription...")
    data = {
        "audio_url": upload_url,
        "word_boost": ["verse", "chorus"],
        "filter_profanity": False,
    }
    try:
        response = requests.post(f"{BASE_URL}/transcript", headers=headers, json=data, timeout=30)
    except Exception as exc:
        raise ValueError(f"Failed to request transcription from AssemblyAI: {exc}")

    if response.status_code not in (200, 201):
        try:
            err_json = response.json()
            err_msg = err_json.get("error") or err_json.get("message") or response.text
        except Exception:
            err_msg = response.text
        raise ValueError(f"AssemblyAI Transcription Request failed ({response.status_code}): {err_msg}")

    transcript_id = response.json().get("id")
    if not transcript_id:
        raise ValueError("Failed to retrieve transcript ID from AssemblyAI")

    # 3. Polling for results
    print(f"AI is analyzing audio (polling transcript {transcript_id})...")
    max_retries = 100 # ~5 minutes max
    for _ in range(max_retries):
        try:
            status_response = requests.get(f"{BASE_URL}/transcript/{transcript_id}", headers=headers, timeout=30)
        except Exception:
            time.sleep(3)
            continue

        if status_response.status_code != 200:
            time.sleep(3)
            continue

        result = status_response.json()
        status = result.get("status")

        if status == "completed":
            print("Transcription complete!")
            return result.get("words", [])
        elif status == "error":
            err = result.get("error", "Unknown error")
            raise ValueError(f"AI Transcription failed: {err}")
        
        time.sleep(3)

    raise TimeoutError("AssemblyAI transcription timed out after 5 minutes.")

def group_words_into_lines(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    The 'Smart Grouper' algorithm.
    Groups individual words into readable lyric lines based on:
    - Punctuation
    - Gaps > 1.0 second
    - Line length (max 8-10 words)
    """
    if not words:
        return []

    lines = []
    current_line_words = []
    
    for i, word_data in enumerate(words):
        text = word_data["text"]
        start = word_data["start"] / 1000.0 # API returns ms, we use seconds
        end = word_data["end"] / 1000.0
        
        current_line_words.append({
            "text": text,
            "start": start,
            "end": end
        })

        should_cut = False
        
        # 1. Punctuation cut
        if text.endswith((".", "?", "!", ",")):
            should_cut = True
            
        # 2. Time gap cut (Gap to next word > 1s)
        if i < len(words) - 1:
            next_start = words[i+1]["start"] / 1000.0
            if (next_start - end) > 1.0:
                should_cut = True
        
        # 3. Max length cut (8 words for readability)
        if len(current_line_words) >= 8:
            should_cut = True

        if should_cut or i == len(words) - 1:
            line_text = " ".join([w["text"] for w in current_line_words])
            line_start = current_line_words[0]["start"]
            
            lines.append({
                "time": line_start,
                "text": line_text
            })
            current_line_words = []

    return lines

def generate_ai_lyrics(
    audio_path: Path,
    song_title: str,
    artist: str = "Unknown Artist",
    api_key: str | None = None
) -> Dict[str, Any]:
    """
    Main entry point: Transcribes -> Groups -> Returns project-ready JSON.
    """
    try:
        raw_words = transcribe_audio(audio_path, api_key=api_key)
        lyric_lines = group_words_into_lines(raw_words)
        
        return {
            "title": song_title,
            "artist": artist,
            "lyrics": lyric_lines
        }
    except Exception as e:
        print(f"Error in generate_ai_lyrics: {e}")
        raise
