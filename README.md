# Lyric Video Generator

An open-source, full-featured lyric video creation suite. Generate cinematic 1080p MP4 lyric videos with smoothly animated typography, synchronized audio, looping backgrounds, and customizable styling.

The project offers **three interactive workflows**:
1. **Modern Web Application & Studio Dashboard**: React 19 + Vite frontend with WaveSurfer.js waveform visualizer and FastAPI backend.
2. **Desktop Studio GUI**: PyQt6 desktop application featuring draggable timeline markers, real-time theme editor, and media preview.
3. **Headless CLI**: Scriptable command-line tool (`lyric-video`) for automated batch rendering and server workflows.

---

## Key Features

- **1080p Full HD Video Rendering**: Hardware-accelerated H.264 video and AAC audio encoding powered by MoviePy and FFmpeg.
- **Dynamic Text Animations**: Smooth vertical scrolling typography with configurable active-line glow, letter spacing, line height, and customizable opacity gradients.
- **Highlighting Modes**: Highlight by entire line, progressive word-by-word, or character-by-character.
- **Ping-Pong Video Loops**: Seamless forward-and-reverse looping for background videos.
- **Multi-Track Input Matching**: Automatically matches audio, lyrics JSON, and background video by song slug.
- **Waveform Timeline Editor**: Zoom, scrub, and drag timestamps directly on an interactive waveform canvas.
- **AI Audio Transcription**: Automatic lyric generation from audio files via AssemblyAI integration.
- **Custom Themes**: JSON-based theme engine to configure colors, fonts, glow effects, drop shadows, and layout positioning.

---

## Prerequisites

Ensure you have the following installed on your system:

1. **Python 3.10+**: [python.org](https://www.python.org/downloads/)
2. **Node.js 18+** & **npm**: [nodejs.org](https://nodejs.org/) (for Web Studio)
3. **FFmpeg**:
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add `bin` to PATH (or run `winget install Gyan.FFmpeg`).
   - **macOS**: `brew install ffmpeg`
   - **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install ffmpeg`

---

## Quick Start & Installation

### 1. Python Environment Setup

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
.\venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Upgrade pip and install all dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install -e .
```

### 2. Web Frontend Setup

```bash
cd web
npm install
cd ..
```

### 3. Environment Configuration

Copy the example environment file and add your API keys (optional, needed for AI transcription):

```bash
cp .env.example .env
```

---

## Running the Project

### Option A: Web Studio & Dashboard (Browser)

The Web Studio provides a browser-based dashboard with audio playback, song management, theme selection, and rendering triggers.

1. **Start the FastAPI backend** (runs on `http://127.0.0.1:8000`):
   ```bash
   python -m src.api.main
   ```

2. **Start the React/Vite development server** (runs on `http://localhost:5173`):
   ```bash
   npm run web:dev
   # Or from within the web directory:
   cd web && npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

---

### Option B: Desktop Studio GUI (PyQt6)

Launch the native desktop interface with timeline editor and draggable markers:

```bash
# Ensure your virtual environment is active
lyric-video-gui
# Or directly via python module:
python -m src.gui.main
```

---

### Option C: Headless Command-Line Interface (CLI)

Generate videos directly from the command line:

```bash
# Auto-match files from the input/ directories by song name
lyric-video --song sample-song

# 30-second quick test preview
lyric-video --song sample-song --preview

# Explicit paths
lyric-video --lyrics input/lyrics/sample-song.json \
            --audio input/audio/sample-song.mp3 \
            --theme themes/default.json \
            --output output/sample-song.mp4

# Style overrides
lyric-video --song sample-song --lyric-position center --highlight-mode word
```

---

## Input Directory Structure

Place your media in the corresponding `input/` folder:

| Folder | Content | Supported Formats |
|---|---|---|
| `input/audio/` | Song audio files | `.mp3`, `.wav`, `.flac`, `.m4a` |
| `input/lyrics/` | Timed lyrics definitions | `.json` |
| `input/backgrounds/` | Background videos or loops | `.mp4`, `.mov`, `.webm`, `.mkv` |
| `themes/` | Theme definitions | `.json` |
| `output/` | Exported lyric videos | `.mp4` |

---

## Lyrics JSON Format

Lyrics are defined in a clean JSON format with timestamps (in seconds) indicating when each line is spoken/sung:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "bpm": 120.0,
  "intro_end_time": 3.0,
  "outro_start_time": 25.0,
  "lyrics": [
    { "time": 0.0, "text": "" },
    { "time": 3.0, "text": "First lyric line appears here" },
    { "time": 7.5, "text": "Second line synchronized to vocals" },
    { "time": 12.0, "text": "Third line of the chorus" },
    { "time": 18.0, "text": "" }
  ]
}
```

> **Important**: Always include an end marker line `{ "time": <end_time>, "text": "" }` at the end of the lyrics array so the renderer knows when the last line finishes.

---

## Theme Customization

Themes control typography, colors, layout, and visual effects. The base theme is in `themes/default.json`:

```json
{
  "name": "Default Theme",
  "background_color": "#1a1a1a",
  "text_color": "#ffffff",
  "active_text_color": "#ffcc00",
  "active_text_bold": true,
  "active_text_glow": true,
  "active_glow_color": "#ffcc00",
  "inactive_text_opacity_gradient": [0.6, 0.4, 0.2],
  "font_family": "Arial",
  "font_size": 72,
  "line_spacing": 1.5,
  "lyric_position": "center",
  "highlight_mode": "line",
  "text_overlay_opacity": 0,
  "text_overlay_color": "#000000"
}
```

---

## Project Structure

```
lyric-video-generator/
├── .env.example              # Template environment variables
├── .gitignore                # Comprehensive multi-language ignore rules
├── package.json              # Root orchestration scripts
├── pyproject.toml            # Python package specification & CLI entrypoints
├── requirements.txt          # Python runtime dependencies
├── README.md                 # Complete project documentation
├── GUIDE.md                  # Detailed user guide
├── DESIGN.md                 # Design tokens and UI style reference
├── assets/                   # App icons and media assets
├── docs/                     # Documentation and screenshots
├── input/
│   ├── audio/                # Audio tracks (.mp3, .wav)
│   ├── backgrounds/          # 6 cinematic preset MP4 background loops
│   └── lyrics/               # Lyrics JSON files (includes sample-song.json)
├── output/                   # Rendered video outputs (gitignored)
├── themes/
│   └── default.json          # Default visual theme definition
├── src/
│   ├── animations/
│   │   └── scroll.py         # Smooth vertical typography scroll engine
│   ├── api/
│   │   └── main.py           # FastAPI REST endpoints for the Web Studio
│   ├── cli/
│   │   └── main.py           # Click-based CLI entry point (lyric-video)
│   ├── core/
│   │   ├── ai_transcriber.py # AssemblyAI automated lyric transcription
│   │   ├── audio_handler.py  # Audio duration and metadata loader
│   │   ├── lyrics_parser.py  # JSON lyrics validator and line builder
│   │   ├── song_resolver.py  # File resolution and song discovery
│   │   ├── text_renderer.py  # Pillow-based multi-line font rendering
│   │   ├── theme_loader.py   # Theme model and loader
│   │   └── video_generator.py# MoviePy video compositor and exporter
│   └── gui/
│       ├── main.py           # PyQt6 GUI entry point (lyric-video-gui)
│       ├── main_window.py    # Desktop studio main window
│       ├── audio_player.py   # Embedded preview audio player
│       ├── styles.py         # Dark mode QSS stylesheets
│       ├── dialogs/          # Dialog modals (new song, theme picker)
│       └── panels/           # Timeline, theme editor, preview panels
└── web/                      # React 19 + Vite web frontend
    ├── package.json          # Web dependencies (WaveSurfer, Lucide, Tailwind)
    ├── vite.config.ts        # Vite configuration
    ├── index.html            # Web entry point
    └── src/
        ├── components/       # UI, Landing, and Dashboard components
        ├── pages/            # Landing page, Dashboard studio, Blog pages
        └── styles/           # Tailwind and CSS styles
```

---

## How to Initialize Your Own GitHub Repository

This directory is an independent, standalone project with no existing Git repository attached. To push it to your own GitHub account:

```bash
# 1. Initialize a new git repository
git init

# 2. Stage all files
git add .

# 3. Create your initial commit
git commit -m "feat: initial commit of standalone lyric video generator"

# 4. Link to your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

---

## License

This project is licensed under the [MIT License](LICENSE).
