# End-to-End Railway Deployment & Vercel Integration Guide

This guide walks you through deploying your **FastAPI + FFmpeg video rendering engine on Railway** and connecting it seamlessly to your **Vercel frontend**.

---

## 1. Overview of the Setup

```
   ┌────────────────────────────────┐         ┌─────────────────────────────────┐
   │         Vercel (Frontend)       │         │        Railway (Backend)        │
   │  - Hosts React / Vite App      │  /api/* │  - Runs Python 3.11 + FastAPI    │
   │  - Fast Global Edge CDN        ├────────►│  - Hardware FFmpeg & MoviePy     │
   │  - Managed via vercel.json     │ Proxied │  - AI Speech-to-Text (Whisper)   │
   │  - $0 serverless tier          │         │  - Persistent Media Generation   │
   └────────────────────────────────┘         └─────────────────────────────────┘
```

---

## 2. What We Have Already Prepared For You

All core files have been configured in your repository:
1. [`Dockerfile`](../Dockerfile): Production container with Python 3.11-slim, pre-installed **FFmpeg**, **ImageMagick**, and TrueType fonts.
2. [`.dockerignore`](../.dockerignore): Keeps your Docker image small and fast to build.
3. [`railway.json`](../railway.json): Automatically instructs Railway to use the Dockerfile with health checks at `/health`.
4. [`Procfile`](../Procfile): Fallback process manager for cloud hosts.
5. [`requirements.txt`](../requirements.txt): Lean production dependencies (excluding heavy desktop GUI libraries).
6. [`src/api/main.py`](../src/api/main.py):
   * Dynamic `$PORT` handling (binds to Railway's assigned port).
   * Healthcheck endpoint at `GET /health`.
   * Automatic startup directory verification (`input/audio`, `input/lyrics`, `input/backgrounds`, `output`).
   * Permissive CORS for Vercel production requests.
7. [`web/vite.config.ts`](../web/vite.config.ts): Local dev proxy so running locally forwards `/api` directly to `127.0.0.1:8000`.
8. [`package.json`](../package.json): Single-command local launcher (`npm run dev` runs both backend and frontend together).

---

## 3. Step-by-Step: Deploying Backend on Railway

### Step 1: Push Your Code to GitHub
Ensure all recent commits are pushed to your GitHub repository:
```bash
git push origin main
```

### Step 2: Create a Railway Project
1. Go to [railway.app](https://railway.app/) and sign in with GitHub.
2. Click **"+ New Project"**.
3. Select **"Deploy from GitHub repo"**.
4. Choose your `lyric-video-generator` repository.

### Step 3: Railway Automatically Builds Your Dockerfile
* Railway will detect [`railway.json`](../railway.json) and [`Dockerfile`](../Dockerfile).
* It will automatically:
  1. Install Linux packages (`ffmpeg`, `imagemagick`, system fonts).
  2. Install Python packages from `requirements.txt`.
  3. Start the FastAPI server on Railway's dynamic `$PORT`.
  4. Perform the health check at `/health`.

### Step 4: Generate a Public Domain
1. In your Railway dashboard, click on your service.
2. Navigate to the **"Settings"** tab.
3. Scroll down to **"Networking"** -> **"Public Networking"**.
4. Click **"Generate Domain"** (e.g. `lyric-video-generator-production.up.railway.app`).
5. Copy this URL!

---

## 4. Step-by-Step: Connecting Railway to Vercel

Once you have your Railway URL (e.g., `https://your-service.up.railway.app`):

1. Open [`vercel.json`](../vercel.json) in your code editor.
2. Update line 12 with your new Railway URL:
   ```json
   {
     "version": 2,
     "public": true,
     "name": "lyric-video-generator",
     "framework": "vite",
     "installCommand": "npm install",
     "buildCommand": "npm run build",
     "outputDirectory": "web/dist",
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://web-production-b506fe.up.railway.app/api/$1"
       },
       {
         "source": "/((?!api/).*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
3. Commit and push:
   ```bash
   git add vercel.json
   git commit -m "chore: connect vercel to railway backend"
   git push origin main
   ```
4. On **Vercel** ([vercel.com](https://vercel.com/)):
   * Click **"Add New Project"** -> Import your GitHub repository.
   * Framework Preset: **Vite**.
   * Root Directory: Leave as root (`./`).
   * Click **"Deploy"**.

**Done!** Your Vercel frontend will now communicate with your Railway FFmpeg video rendering engine seamlessly.

---

## 5. Local Development (Run Everything in 1 Terminal)

You no longer need to open two terminals manually! From the root directory, simply run:

```bash
npm run dev
```

This launches:
* **[API]** FastAPI backend on `http://127.0.0.1:8000`
* **[WEB]** React / Vite studio on `http://localhost:5173`
