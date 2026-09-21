export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  category: string;
  readTime: string;
  featuredImage: string;
  contentImages?: string[];
}

export const blogs: BlogPost[] = [
  {
    id: 'frame-accurate-audio-sync',
    title: 'Achieving Frame-Accurate Audio Synchronization in the Browser',
    excerpt: 'Why traditional DOM audio playback drifts across 60 FPS timelines and how we solved it with AudioContext clocks and SMPTE timecodes.',
    date: 'Sep 18, 2026',
    category: 'Architecture',
    readTime: '6 min',
    featuredImage: '/blogs/images/bcg-oa-round-1.png',
    content: `
# Achieving Frame-Accurate Audio Synchronization in the Browser
Frame accuracy in web media editors is notoriously tricky. When building lyric video generators and timeline NLEs, standard HTML5 \`<audio>\` or \`<video>\` elements exhibit micro-stutters and clock drift during seek operations.

### The Problem: DOM Clock vs Hardware Clocks
The HTML5 \`currentTime\` property reports audio position quantized to the browser's event loop tick (typically 16.6ms or slower when main-thread load spikes). For a 60 FPS video renderer, a 16ms variance can cause subtitles to visually lag behind the vocal transient by up to 2 frames.

### The Solution: Web Audio API & AudioContext Clocks
To guarantee sample-accurate synchronization across all viewports:
1. **Hardware-Linked Timestamps:** We bind playback to \`AudioContext.currentTime\`, which references the hardware audio buffer clock rather than the DOM render loop.
2. **SMPTE Fractional Offsets:** We store all lyric clip start and end points in floating-point seconds with 3 decimal precision (e.g., \`12.450s\`).
3. **Sub-Pixel Playhead Interpolation:** Visual playhead position is computed via \`requestAnimationFrame\` against monotonic hardware time rather than polling audio events.

* **Result:** Jitter is reduced from ±18ms to under 0.8ms, ensuring crisp syllable highlights exactly when the vocalist sings.
    `
  },
  {
    id: 'universal-subtitle-parsing',
    title: 'Universal Subtitle Parsing: Decoding LRC, Enhanced LRC, and SRT',
    excerpt: 'Handling millisecond offsets, multi-syllable karaoke tags, and multi-language UTF-8 encoding in real-time web streams.',
    date: 'Sep 14, 2026',
    category: 'Engineering',
    readTime: '5 min',
    featuredImage: '/blogs/images/research-blog-6.png',
    content: `
# Universal Subtitle Parsing: Decoding LRC, Enhanced LRC, and SRT
Subtitle formats across audio streaming services and NLEs range from legacy SubRip (\`.srt\`) to standard line-timed LRC (\`.lrc\`) and syllable-level Enhanced LRC (\`<00:01.20>word<00:01.50>\`).

### Parsing Challenges
Different audio DAWs and distributors output varied timestamp formats:
* **Standard LRC:** \`[mm:ss.xx]\` or \`[mm:ss.xxx]\` representing line trigger points.
* **Enhanced LRC:** Inline tags interleaved directly within word boundaries for karaoke tracking.
* **SubRip (SRT):** Sequential indices with arrow-separated ranges (\`00:00:01,000 --> 00:00:03,500\`).

### Architectural Implementation
LyricGen's ingestion pipeline provides an unified parser that:
1. Detects encoding automatically (UTF-8, UTF-16LE, Latin-1).
2. Normalizes timestamps to canonical float seconds.
3. Automatically computes word durations by measuring inter-word gap distances or syllable markers.
4. Generates an immutable clip stack ready for non-destructive visual styling.
    `
  },
  {
    id: 'fluid-syllable-wipes',
    title: 'Rendering Fluid Syllable Wipes at 60 FPS Without Dropped Frames',
    excerpt: 'Implementing hardware-accelerated linear clip-paths and WebGL shaders for word-by-word broadcast karaoke highlights.',
    date: 'Sep 09, 2026',
    category: 'Graphics',
    readTime: '8 min',
    featuredImage: '/blogs/images/deloitte-oa-platforms.png',
    content: `
# Rendering Fluid Syllable Wipes at 60 FPS Without Dropped Frames
The hallmark of professional broadcast lyric videos (seen on MTV, YouTube, and Apple Music) is the seamless horizontal fill animation that tracks each vocal syllable.

### Naive vs Hardware Accelerated Approaches
Many web prototypes attempt to animate syllable color transitions using canvas re-draws or CSS text gradients on every frame. When rendering at 4K or 1080p60, this causes significant compositor thread thrashing.

### The Clip-Path Inset Pipeline
We implement a two-layer compositor:
1. **Base Layer:** Renders the inactive subtitle text in muted cream (\`#fffbeb\` at 30% opacity) or subtle outline.
2. **Active Wipe Layer:** An identical duplicate text layer styled in Signal Teal (\`#00b18c\`) clipped via a dynamic horizontal clip path:
\`\`\`css
clip-path: inset(0 calc(100% - var(--wipe-percentage)) 0 0);
\`\`\`
Because CSS clip-path inset operations are offloaded directly to GPU rasterization tiles, framerates remain locked at 60 FPS even on mobile and low-power laptops.
    `
  },
  {
    id: 'social-safe-zones-guide',
    title: 'Social Safe Zones: Preventing UI Collision on TikTok, Reels & Shorts',
    excerpt: 'Standardizing dynamic aspect ratio guides for 9:16 vertical storytelling so captions never get obscured by platform UI overlays.',
    date: 'Aug 29, 2026',
    category: 'Production',
    readTime: '4 min',
    featuredImage: '/blogs/images/pm-prep-blog-1.jpg',
    content: `
# Social Safe Zones: Preventing UI Collision on TikTok, Reels & Shorts
Creating a vertical (9:16) lyric video for TikTok or Instagram Reels requires strict adherence to safe visual zones. 

### The Problem of Platform Chrome
Every social app overlays critical interface elements on top of the video:
* **Right Rail:** Profile icon, like heart, comment bubble, bookmark, and audio disc (covering 80px to 120px on the right edge).
* **Bottom Region:** Sound title marquee, author handle, and multi-line captions (obscuring the bottom 20% of the screen).
* **Top Header:** Search bar, Following/For You tabs (occupying the top 100px).

### The In-Editor Safe Zone Overlay
In LyricGen Studio, toggling the Safe Zones guide draws calibrated semi-transparent overlays matching TikTok and Reels guidelines:
* 120px top margin exclusion zone
* 240px bottom margin exclusion zone
* 110px right margin interaction corridor

With these visual bounds permanently visible during composition, lyrics and key visual typography remain 100% legible across every target platform.
    `
  }
];
