from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Request
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
)
from src.core.video_generator import generate_video
from src.core.theme_loader import load_theme, Theme, THEME_PRESETS
from src.core.lyrics_parser import parse_lrc_string, parse_srt_string
from src.core.ai_transcriber import generate_ai_lyrics

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

@app.get("/api/songs")
async def get_songs():
    """List all available songs in the input directory."""
    return scan_songs()

@app.get("/api/backgrounds")
async def get_backgrounds():
    """List all available background video files."""
    extensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    bg_files = []
    if INPUT_BACKGROUNDS_DIR.exists():
        for f in INPUT_BACKGROUNDS_DIR.iterdir():
            if f.suffix.lower() in extensions:
                bg_files.append(f.name)
    return bg_files

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
            (INPUT_BACKGROUNDS_DIR, [".mp4", ".mov", ".avi", ".mkv", ".webm"]),
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
        ext = Path(background.filename).suffix
        path = INPUT_BACKGROUNDS_DIR / f"{slug}{ext}"
        with path.open("wb") as buffer:
            shutil.copyfileobj(background.file, buffer)
        saved_paths["background"] = str(path)
    elif background_preset:
        # User selected an existing background from the grid
        src_path = INPUT_BACKGROUNDS_DIR / background_preset
        if src_path.exists():
            dest_path = INPUT_BACKGROUNDS_DIR / f"{slug}{src_path.suffix}"
            if src_path != dest_path: # Avoid copying to self
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
