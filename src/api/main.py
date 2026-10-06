from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
import shutil
import json

from src.core.song_resolver import (
    resolve_song,
    scan_songs,
    get_song_files,
    PROJECT_ROOT,
    INPUT_AUDIO_DIR,
    INPUT_LYRICS_DIR,
    INPUT_BACKGROUNDS_DIR,
    THEMES_DIR,
    BACKGROUND_EXTENSIONS,
)
from src.core.video_generator import generate_video
from src.core.theme_loader import load_theme, Theme, THEME_PRESETS
from src.core.lyrics_parser import parse_lrc_string, parse_srt_string
from src.core.ai_transcriber import generate_ai_lyrics
from src.core.lyrics_finder import find_lyrics, LyricsFinderError
import aiohttp  # for /api/lyrics/suggest endpoint

# Optional Spotify service import
try:
    from src.core.spotify_service import SpotifyService, SpotifyDownloadError, SpotifyServiceUnavailable
    SPOTIFY_AVAILABLE = True
except ImportError as e:
    SPOTIFY_AVAILABLE = False
    print(f"Spotify service not available: {e}")

app = FastAPI(title="Lyric Video Generator API")

@app.on_event("startup")
def ensure_directories():
    """Ensure all required media directories exist on container startup."""
    output_dir = PROJECT_ROOT / "output"
    for d in [INPUT_AUDIO_DIR, INPUT_LYRICS_DIR, INPUT_BACKGROUNDS_DIR, output_dir]:
        d.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Lyric Video Generator API is running", "version": "0.1.2"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "lyric-video-generator-api", "version": "0.1.2"}

# Enable CORS for React development and Vercel production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Storage for active generation jobs (simplified for MVP)
jobs = {}
print("=== Lyric Video Generator API Starting ===")  # DEBUG
print(f"spotDL available: {SPOTIFY_AVAILABLE}")  # DEBUG
print(f"aiohttp available: {bool(aiohttp)}")  # DEBUG

@app.get("/api/songs")
async def get_songs():
    """List all available songs in the input directory."""
    return scan_songs()

@app.get("/api/backgrounds")
async def get_backgrounds():
    """List all available background files (video and static images)."""
    bg_files = []
    if INPUT_BACKGROUNDS_DIR.exists():
        for f in INPUT_BACKGROUNDS_DIR.iterdir():
            if f.suffix.lower() in BACKGROUND_EXTENSIONS:
                bg_files.append(f.name)
    return bg_files


@app.get("/api/lyrics/suggest")
async def lyrics_suggest(term: str = Query(..., description="Search term for artist/song suggestions")):
    """Search suggestions for artist/song pairs (powered by NetEase Music API)."""
    print(f"[lyrics/suggest] Searching for: '{term}'")  # DEBUG
    if not term or not term.strip():
        print("[lyrics/suggest] Empty term, returning empty")  # DEBUG
        return {"suggestions": []}
    
    try:
        from src.core.lyrics_finder import find_lyrics, LyricsFinderError, _search_track
        import asyncio
        
        # Use the internal search to get candidates (without fetching full lyrics)
        async def _get_candidates():
            async with aiohttp.ClientSession() as session:
                return await _search_track(session, term)
        
        candidates = await _get_candidates()
        print(f"[lyrics/suggest] Found {len(candidates)} candidates")  # DEBUG
        
        suggestions = [
            {"artist": c["item"]["artist"], "title": c["item"]["title"]}
            for c in candidates
        ]
        print(f"[lyrics/suggest] Returning {len(suggestions)} suggestions")  # DEBUG
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"[lyrics/suggest] ERROR: {e}")  # DEBUG
        import traceback
        traceback.print_exc()
        return {"suggestions": []}


@app.post("/api/lyrics/search")
async def lyrics_search(request: Request):
    """
    Search for lyrics by song title/artist and return timestamped JSON.
    
    This endpoint enables the dashboard to auto-fill lyrics with timestamps.
    It uses the NetEase Music API via lyrics_finder.py to fetch LRC lyrics,
    parse timestamps, and return them in dashboard-ready format.
    
    Request body:
        { "title": "Bohemian Rhapsody", "artist": "Queen" }
        or
        { "query": "Bohemian Rhapsody Queen" }
    
    Returns:
        {
            "success": true,
            "title": "Bohemian Rhapsody",
            "artist": "Queen",
            "lyrics": [
                { "time": 0.14, "text": "Is this the real life" },
                { "time": 3.87, "text": "Is this just fantasy" },
                ...
                { "time": 342.95, "text": "" }
            ],
            "lyrics_count": 67
        }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    title = body.get("title", "").strip()
    artist = body.get("artist", "").strip()
    query = body.get("query", "").strip()
    
    # Support query-style requests
    if query and not title:
        parts = query.rsplit(" ", 1)
        if len(parts) == 2:
            title = parts[0].strip()
            artist = parts[1].strip()
        else:
            title = query
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    try:
        from src.core.lyrics_finder import get_lyrics_as_json
        
        print(f"[lyrics/search] Calling get_lyrics_as_json for '{title}' by '{artist}'")  # DEBUG
        lyrics_data = get_lyrics_as_json(title, artist)
        lyrics_count = len([l for l in lyrics_data["lyrics"] if l["text"]])
        print(f"[lyrics/search] SUCCESS: {lyrics_count} lines")  # DEBUG
        
        return {
            "success": True,
            "title": lyrics_data["title"],
            "artist": lyrics_data["artist"],
            "lyrics": lyrics_data["lyrics"],
            "lyrics_count": lyrics_count,
            "duration_seconds": lyrics_data["lyrics"][-1]["time"] if lyrics_data["lyrics"] else 0
        }
    except Exception as exc:
        print(f"[lyrics/search] ERROR for '{title} by {artist}': {exc}")  # DEBUG
        import traceback
        traceback.print_exc()
        from src.core.lyrics_finder import LyricsFinderError
        if isinstance(exc, LyricsFinderError):
            if "No lyrics found" in str(exc):
                raise HTTPException(status_code=404, detail=str(exc))
            raise HTTPException(status_code=502, detail=str(exc))
        raise HTTPException(status_code=500, detail=f"Lyrics search failed: {str(exc)}")


@app.get("/api/lyrics/finder")
async def lyrics_finder(artist: str, title: str):
    """Fetch full lyrics for a song from NetEase Music API."""
    print(f"[lyrics/finder] Request: artist='{artist}', title='{title}'")  # DEBUG
    if not artist or not artist.strip():
        print("[lyrics/finder] ERROR: missing artist")  # DEBUG
        raise HTTPException(status_code=400, detail="artist query parameter is required")
    if not title or not title.strip():
        print("[lyrics/finder] ERROR: missing title")  # DEBUG
        raise HTTPException(status_code=400, detail="title query parameter is required")
    try:
        lyrics = find_lyrics(title.strip(), artist.strip())
        print(f"[lyrics/finder] SUCCESS: got {len(lyrics)} chars of lyrics")  # DEBUG
    except ValueError as ve:
        print(f"[lyrics/finder] ValueError: {ve}")  # DEBUG
        raise HTTPException(status_code=400, detail=str(ve))
    except LyricsFinderError as lfe:
        print(f"[lyrics/finder] LyricsFinderError: {lfe}")  # DEBUG
        raise HTTPException(status_code=404, detail=str(lfe))
    except Exception as exc:  # noqa: BLE001
        print(f"[lyrics/finder] UNEXPECTED ERROR: {exc}")  # DEBUG
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail="Lyrics service unavailable")
    return {"lyrics": lyrics}

@app.get("/api/presets")
async def get_presets():
    """List all available theme presets."""
    return THEME_PRESETS

@app.get("/api/songs/{slug}")
async def get_song_details(slug: str):
    """Get resolved paths and details for a specific song (supports partial songs)."""
    files = get_song_files(slug)
    if not any(files.values()):
        raise HTTPException(status_code=404, detail=f"Song '{slug}' not found")
    return {k: str(v) if v else None for k, v in files.items()}

@app.delete("/api/songs/{slug}")
async def delete_song(slug: str):
    """Delete all files associated with a song slug."""
    try:
        deleted = []
        failed = []
        
        # Check all possible media directories for files belonging to this slug
        targets = [
            (INPUT_AUDIO_DIR, [".mp3", ".wav", ".m4a", ".flac", ".ogg"]),
            (INPUT_LYRICS_DIR, [".json", ".lrc", ".srt", ".vtt"]),
            (INPUT_BACKGROUNDS_DIR, BACKGROUND_EXTENSIONS),
            (THEMES_DIR, [".json"]),
            (PROJECT_ROOT / "output", [".mp4"])
        ]
        
        for directory, extensions in targets:
            if not directory.exists():
                continue
            for ext in extensions:
                pattern = f"{slug}{ext}" if directory != (PROJECT_ROOT / "output") else f"{slug}*{ext}"
                for file_path in directory.glob(pattern):
                    try:
                        file_path.unlink()
                        deleted.append(str(file_path.name))
                    except PermissionError:
                        failed.append({str(file_path.name): "File in use (Permission Denied)"})
                    except Exception as e:
                        failed.append({str(file_path.name): str(e)})
        
        return {"status": "success", "deleted": deleted, "failed": failed}
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_files(
    audio: UploadFile = File(None),
    lyrics: UploadFile = File(None),
    background: UploadFile = File(None),
    slug: str = Form(None),
    background_preset: str = Form(None)
):
    """Upload audio, lyrics, or background files for a song slug."""
    if not slug:
        raise HTTPException(status_code=400, detail="Slug is required")
    
    saved_paths = {}
    
    if audio:
        ext = Path(audio.filename).suffix
        path = INPUT_AUDIO_DIR / f"{slug}{ext}"
        with path.open("wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        saved_paths["audio"] = str(path)
        
    if lyrics:
        ext = Path(lyrics.filename).suffix.lower()
        if ext == ".lrc":
            content = (await lyrics.read()).decode("utf-8", errors="ignore")
            parsed = parse_lrc_string(content, default_title=slug)
            path = INPUT_LYRICS_DIR / f"{slug}.json"
            with path.open("w", encoding="utf-8") as f:
                json.dump(parsed, f, indent=2, ensure_ascii=False)
            saved_paths["lyrics"] = str(path)
        elif ext in (".srt", ".vtt"):
            content = (await lyrics.read()).decode("utf-8", errors="ignore")
            parsed = parse_srt_string(content, default_title=slug)
            path = INPUT_LYRICS_DIR / f"{slug}.json"
            with path.open("w", encoding="utf-8") as f:
                json.dump(parsed, f, indent=2, ensure_ascii=False)
            saved_paths["lyrics"] = str(path)
        else:
            path = INPUT_LYRICS_DIR / f"{slug}.json"
            with path.open("wb") as buffer:
                shutil.copyfileobj(lyrics.file, buffer)
            saved_paths["lyrics"] = str(path)
        
    if background:
        ext = Path(background.filename).suffix.lower()
        if ext not in BACKGROUND_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported background format: {ext}. Supported: {', '.join(sorted(BACKGROUND_EXTENSIONS))}",
            )
        path = INPUT_BACKGROUNDS_DIR / f"{slug}{ext}"
        with path.open("wb") as buffer:
            shutil.copyfileobj(background.file, buffer)
        saved_paths["background"] = str(path)
    elif background_preset:
        # User selected an existing background from the grid
        src_path = INPUT_BACKGROUNDS_DIR / background_preset
        if src_path.exists():
            dest_path = INPUT_BACKGROUNDS_DIR / f"{slug}{src_path.suffix}"
            if src_path != dest_path:  # Avoid copying to self
                shutil.copy2(src_path, dest_path)
            saved_paths["background"] = str(dest_path)
        
    return {"status": "success", "paths": saved_paths}

@app.post("/api/generate")
async def start_generation(data: dict, background_tasks: BackgroundTasks):
    """Start the video generation process in the background."""
    song_slug = data.get("song_slug")
    theme_data = data.get("theme")
    aspect_ratio = data.get("aspect_ratio") or (theme_data.get("aspect_ratio") if theme_data else "16:9")
    output_name = data.get("output_name", f"{song_slug}_{aspect_ratio.replace(':', 'x')}.mp4")
    fps = int(data.get("fps", 30))
    
    if not song_slug:
        raise HTTPException(status_code=400, detail="song_slug is required")
    
    job_id = str(uuid.uuid4())
    output_path = PROJECT_ROOT / "output" / output_name
    
    jobs[job_id] = {"status": "processing", "progress": 0, "output": str(output_path)}
    
    # Task to run in background
    def run_gen():
        try:
            print(f"Background task started for job {job_id}")
            # Resolve song paths
            paths = resolve_song(song_slug)
            
            # Load default theme and merge overrides
            theme = load_theme()
            if theme_data:
                # Merge incoming theme data
                for k, v in theme_data.items():
                    if hasattr(theme, k):
                        setattr(theme, k, v)
            
            # Progress callback for the API
            def on_progress(current, total):
                jobs[job_id]["progress"] = int((current / total) * 100)

            # Run MoviePy generation
            generate_video(
                audio_path=paths["audio"],
                lyrics_path=paths["lyrics"],
                output_path=output_path,
                theme=theme,
                background_path=paths["background"],
                fps=fps,
                aspect_ratio=aspect_ratio,
                logger=None,
                progress_callback=on_progress
            )
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            print(f"Job {job_id} completed successfully")
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Job {job_id} failed: {error_trace}")
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)

    background_tasks.add_task(run_gen)
    return {"job_id": job_id}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Check the status of a generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/download/{job_id}")
async def download_video(job_id: str):
    """Download the generated video."""
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed or not found")
    
    path = Path(jobs[job_id]["output"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing")
        
    return FileResponse(path, filename=path.name, media_type="video/mp4")

@app.get("/api/download_raw")
async def download_raw(path: str):
    """Serve a raw file by absolute path."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(p)


# ──────────────────────────────────────────────────────────────────────────
# Spotify Integration Endpoints
# ──────────────────────────────────────────────────────────────────────────

@app.get("/api/spotify/status")
async def spotify_status():
    """Check if Spotify download service is available."""
    print("[spotify/status] Checking Spotify availability")  # DEBUG
    if not SPOTIFY_AVAILABLE:
        print("[spotify/status] Spotify NOT available - spotDL not installed")  # DEBUG
        return {
            "available": False,
            "reason": "spotDL not installed",
            "install_instruction": "uv pip install spotdl"
        }

    try:
        service = SpotifyService(INPUT_AUDIO_DIR)
        status = service.get_status()
        print(f"[spotify/status] Spotify OK: {status}")  # DEBUG
        return status
    except Exception as e:
        print(f"[spotify/status] ERROR: {e}")  # DEBUG
        return {
            "available": False,
            "reason": str(e),
        }


@app.post("/api/spotify/search")
async def spotify_search(request: Request):
    """Search Spotify for songs matching a query."""
    print(f"[spotify/search] Request: '{query}'")  # DEBUG is set below; keep as-is after fix
    if not SPOTIFY_AVAILABLE:
        print("[spotify/search] Spotify NOT available")  # DEBUG
        raise HTTPException(
            status_code=503,
            detail="Spotify service not available. Install spotDL with: uv pip install spotdl"
        )

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    query = body.get("query", "").strip()
    limit = body.get("limit", 10)
    print(f"[spotify/search] Query: '{query}', limit={limit}")  # DEBUG

    if not query:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    try:
        service = SpotifyService(INPUT_AUDIO_DIR)
        results = service.search(query, limit=limit)
        print(f"[spotify/search] Found {len(results)} results")  # DEBUG
        return {"results": [r.to_dict() for r in results]}
    except SpotifyDownloadError as e:
        print(f"[spotify/search] SpotifyDownloadError: {e}")  # DEBUG
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[spotify/search] UNEXPECTED ERROR: {e}")  # DEBUG
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/api/spotify/download")
async def spotify_download(request: Request, background_tasks: BackgroundTasks):
    """Download a song from Spotify."""
    print("[spotify/download] Received download request")  # DEBUG
    if not SPOTIFY_AVAILABLE:
        print("[spotify/download] Spotify NOT available")  # DEBUG
        raise HTTPException(
            status_code=503,
            detail="Spotify service not available. Install spotDL with: uv pip install spotdl"
        )

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    spotify_url = body.get("url", "").strip()
    song_slug = body.get("slug", "").strip()
    print(f"[spotify/download] URL={spotify_url}, slug={song_slug}")  # DEBUG

    if not spotify_url:
        raise HTTPException(status_code=400, detail="Spotify URL is required")

    if not song_slug:
        raise HTTPException(status_code=400, detail="Song slug is required")

    try:
        service = SpotifyService(INPUT_AUDIO_DIR)

        # Run download in background to avoid blocking
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "status": "downloading",
            "progress": 0,
            "type": "spotify_download",
            "slug": song_slug,
        }

        async def download_task():
            try:
                audio_path, metadata = await service.download(
                    spotify_url,
                    progress_callback=lambda progress: jobs[job_id].update(progress)
                )

                # Move to standard location
                target_path = service.move_to_song_directory(audio_path, song_slug)

                jobs[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "audio_path": str(target_path),
                    "metadata": metadata,
                })
                print(f"[spotify/download] SUCCESS: {target_path}")  # DEBUG
            except Exception as e:
                jobs[job_id].update({
                    "status": "failed",
                    "error": str(e),
                })
                print(f"[spotify/download] FAILED: {e}")  # DEBUG

        background_tasks.add_task(download_task)
        print(f"[spotify/download] Started job {job_id}")  # DEBUG
        return {"job_id": job_id, "status": "started"}

    except SpotifyDownloadError as e:
        print(f"[spotify/download] SpotifyDownloadError: {e}")  # DEBUG
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[spotify/download] UNEXPECTED ERROR: {e}")  # DEBUG
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@app.get("/api/spotify/download-status/{job_id}")
async def spotify_download_status(job_id: str):
    """Check the status of a Spotify download job."""
    print(f"[spotify/download-status] Checking job {job_id}")  # DEBUG
    if job_id not in jobs:
        print(f"[spotify/download-status] Job {job_id} not found")  # DEBUG
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job.get("type") != "spotify_download":
        print(f"[spotify/download-status] Job {job_id} is not a Spotify download")  # DEBUG
        raise HTTPException(status_code=400, detail="Not a Spotify download job")

    print(f"[spotify/download-status] Job {job_id}: {job}")  # DEBUG
    return job

@app.post("/api/auto-lyrics/{slug}")
async def auto_lyrics(slug: str, request: Request):
    """Automatically generate lyrics from audio using AssemblyAI."""
    try:
        # Check request headers or query params for custom API key
        custom_key = request.headers.get("x-assemblyai-key") or request.query_params.get("api_key")
        
        from src.core.song_resolver import _find_audio
        audio_path = _find_audio(slug)
        
        if not audio_path or not audio_path.exists():
            raise HTTPException(
                status_code=400,
                detail=f"Audio file not found for '{slug}'. Please upload an audio file (.mp3, .wav) before requesting AI lyrics."
            )

        # Call AI service with optional custom key
        result = generate_ai_lyrics(audio_path, song_title=slug, api_key=custom_key)
        
        # Save to lyrics folder
        lyrics_file = INPUT_LYRICS_DIR / f"{slug}.json"
        with lyrics_file.open("w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        return {"status": "success", "lyrics_path": str(lyrics_file), "data": result}
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except TimeoutError as te:
        raise HTTPException(status_code=504, detail=str(te))
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    import os
    port_env = os.environ.get("PORT", "8000").strip()
    port = int(port_env) if port_env.isdigit() else 8000
    print(f"Starting server on 0.0.0.0:{port}")
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=port, reload=False)
