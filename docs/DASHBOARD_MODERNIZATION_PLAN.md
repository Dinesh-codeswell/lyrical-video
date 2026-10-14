# Dashboard Modernization Plan
## Filters, Animations, Transitions, Font Styles & Text Animations

> **Status:** Living document — follow-on reference for all dashboard VFX work.
> **Date created:** 2026-10-12
> **Compared against:** FilmCraft (`filmcraft-main/`) — open-source Premiere-class NLE (Rust).
> **Scope (by request):** ONLY filters, animations, transitions, font styles, and text
> animations as used in modern/trending lyrical video generation. Nothing else.

---

## 1. Executive Summary

Our web dashboard (`web/src`) is a solid **v1** for lyric video styling: 14 CSS-based
filters, 12 clip-path transitions, 5 text animation styles, karaoke word/char wipes, and
6 theme presets. The final render is done in Python (moviepy/Pillow) with only `scroll.py`
implemented.

FilmCraft demonstrates what a **professional-grade** effect stack looks like: ~40
parameterized video effects (including a full Lumetri color engine with curves + HSL
secondary), 84 transitions across 10 folders, 15 blend modes, per-effect masks, and a
full text engine (shaping, per-character style runs, rolls/crawls, stroke kinds).

**The gap is not quality of existing effects — it is breadth, modernity, and
lyric-video-specific motion design.** Modern lyric videos (2024–2026 trends) rely on
kinetic typography, beat-synced camera moves, karaoke gradient fills, variable fonts,
gradient/holographic text, halation, bloom, and whip/zoom-punch transitions. Most of
these can be implemented in our DOM/CSS + Web Animations preview layer, then mirrored in
the Python renderer.

This document lists **every recommendation** with priority, the modern style it maps to,
the FilmCraft concept it borrows (where applicable), and a phased implementation plan.

---

## 2. Current State Analysis (Our Dashboard)

### 2.1 Filters (`types/index.ts` → `VISUAL_EFFECTS`, `Dashboard.css` compositor layers)
| # | Filter | Category | Implementation |
|---|--------|----------|----------------|
| 1 | none | color | — |
| 2 | teal-orange | color | CSS `contrast/saturate/hue-rotate` |
| 3 | cyberpunk-neon | color | CSS filter |
| 4 | vintage-1977 | retro | CSS `sepia/contrast/saturate` |
| 5 | silver-noir | color | CSS `grayscale/contrast` |
| 6 | pastel-dream | color | CSS `brightness/contrast` |
| 7 | sunset-gold | color | CSS `sepia/saturate` |
| 8 | film-grain | texture | overlay `<div>` noise layer |
| 9 | vhs-glitch | retro | overlay layer |
| 10 | crt-monitor | retro | overlay scanlines |
| 11 | liquid-wave | texture | overlay/displacement |
| 12 | pixelate-mosaic | retro | overlay |
| 13 | cinematic-vignette | texture | radial-gradient overlay |
| 14 | prism-leak | texture | gradient overlay |

Plus Phase-2 scalar params: `background_blur`, `letterbox_bars`, `pixelate_block_size`,
`wave_amplitude/speed`, `chroma_key_*`, `filter_intensity` (0–100), `vignette_enabled`.

**Strengths:** fast, zero-dependency, GPU-composited by the browser.
**Weaknesses:** no real color grading (curves/wheels), no per-clip filters (only global
theme filter), no blend modes, no parameterized effect stacks, no intensity curves.

### 2.2 Transitions (`TRANSITIONS_CATALOG`) — 12 total, 4 categories
- **dissolve:** crossfade, dip-black, flash-white, glitch-dissolve
- **wipe:** wipe-left, wipe-right, iris-wipe, diagonal-slash
- **motion:** slide-up, push-left, zoom-punch
- **light:** light-leak

Implemented via CSS `clip-path` insets + opacity (documented in `blogs.ts`). Per-clip
overrides exist on `LyricClip.transition` / `transition_duration`.

### 2.3 Text Animations (`animation_style`, Motion tab) — 5 styles
| Style | Badge | Behavior |
|-------|-------|----------|
| scroll | Classic | continuous vertical roll |
| typewriter | Retro | char-by-char + blinking cursor |
| kinetic | Modern | elastic bounce-in per line |
| fade | Clean | rise + opacity fade |
| slide | Energetic | lateral entrance w/ deceleration |

Plus: `animation_speed` 0.2–3.0× multiplier. Karaoke highlight modes: line / word /
character with scale-pop on active word. Active-text: bold toggle, neon glow
(`text-shadow`), stroke (`-webkit-text-stroke`), opacity gradient for inactive lines.

### 2.4 Font Styles
- **Hardcoded `Arial` in every preset** (+ `JetBrains Mono` in Matrix Terminal).
- No font picker UI, no bundled webfonts, no weight/style axis control.
- Python renderer relies on system-installed fonts → non-deterministic output.

### 2.5 Rendering Pipeline
- **Preview:** pure DOM/CSS in `Dashboard.tsx` (`renderLineStyles`, `renderLineText`,
  compositor-layer divs for grain/vignette/etc.).
- **Final render:** Python `moviepy`/Pillow; `src/animations/` contains only `scroll.py`.
  Web-side animation styles (typewriter/kinetic/fade/slide) are **not yet ported** to the
  Python renderer — a known divergence.

---

## 3. FilmCraft Capabilities (Reference Architecture)

### 3.1 Effects (crates/project/effect.rs, render/lumetri_presets.rs)
- **~40 parameterized video effects** in a registry (EffectDef with ParamDefs:
  float sliders, colors, curves, choice enums, points - each animatable via keyframes).
- **Lumetri color engine:** exposure/contrast/saturation, HDR white, look intensity,
  creative saturation, **shadow/highlight tint color wheels**, **luma/R/G/B curves**,
  **hue-vs-sat / hue-vs-hue / hue-vs-luma / luma-vs-sat / sat-vs-sat curves**, and
  **HSL secondary** (hue center/range, sat min, luma min/max, show-mask preview).
- **Lumetri presets** in 4 folders: Cinematic (Teal Shadows Warm Skin, Night Exterior,
  Golden Dusk, Hard Sun), Film Emulation (Faded Print, Silver Retention, Cross
  Processed), Monochrome (Hard Mono, Sepia Tone), Technical (Legal Range Squeeze) -
  each defined as parameter sets, with **procedurally rendered preview thumbnails**.
- Other effects: gaussian_blur, directional_blur, unsharp_mask, levels, proc_amp,
  extract, mosaic, emboss, strobe, noise, crop, transform, lens_distortion, twirl,
  wave_warp, drop_shadow, bevel_alpha, ultra_key, track_matte, color_key,
  four_color_gradient, ramp, tint, color_balance, leave_color, change_to_color,
  brightness_contrast, look (creative LUT-style).
- **15 blend modes** (Normal, Dissolve, Darken, Multiply, Lighten, Screen, Overlay,
  Difference, Exclusion, Subtract, Divide, Hue, Saturation, Color, Luminosity).
- **Per-effect masks** with feather/falloff (render/mask.rs).

### 3.2 Transitions (crates/project/vtransition.rs) - 84 in 10 folders
| Folder | Notable transitions (params) |
|--------|------------------------------|
| Animation | block/flip/fold/pop/pull/spring/travel **motion** (direction, random, **overshoot**) |
| Dissolve | additive, **blur dissolve** (blur amount), cross, dip-to-black, **dip-to-color**, dip-to-white, film, **morph cut** |
| Grunge & Distort | chaos, **earthquake** (shake), flicker, **glass** (shard size), **glitch** (amount+seed), **kaleidoscope** (segments), tv_power, **vhs_damage** |
| Immersive | VR chroma leaks, gradient wipe, iris, light leaks, **light rays**, **mobius zoom**, spherical blur |
| Lights & Blurs | burn_chroma, chroma_leak, **cross_zoom** (strength), directional_blur, **flare**, flash (color), **glow** (radius), **lens_blur** (iris radius), light_leak, **phosphor**, radial_blur, **ray** (length), solarize, **zoom_blur** |
| Slide | 3D roll, push, roll, slide, split, stretch, **whip** (blur) - all with **motion blur** |
| Smart Tools | **motion_camera** (zoom), **motion_tween** (scale), **shape_flow** (circle/square/diamond/star/heart/triangle/hexagon) |
| Text | **text_animator** (columns) |
| Transformers | 3D spin, 3D spinback (perspective), **louver** (slats), **mirror**, **slice** |
| Wipe | **clock**, **linear** (angle + border width/color + AA quality + feather), **panel**, **radial** (corner), soft, **stretch** |

Common params: direction (N/E/S/W), motion blur %, border width/color, antialias
quality, feather, random seed, amount %, center point.

### 3.3 Text Engine (crates/text/) - the gold standard
- Bundled **OFL fonts**: Inter (default), JetBrains Mono, Noto Serif + system font scan.
- **Real text shaping** (harfrust): kerning, ligatures, complex scripts, bidi, line
  breaking; cached layout; sub-pixel glyph positioning.
- **Per-character style runs** (font, style, size, fill, faux bold/italic, underline,
  tracking, baseline shift, caps) - see graphic_design.rs.
- **Stroke kinds:** outer/centre/inner via Euclidean distance transform; blur; offsets.
- **Rolls & crawls** with preroll, ease-in/out, postroll (roll_offset/roll_progress).
- **Responsive design:** position pins (layers grow with text), time remapping.

---

## 4. Gap Analysis -> Recommendations

Priority legend: **P0** = high impact / core modern standard, do first;
**P1** = important, second wave; **P2** = nice-to-have polish.

### 4.1 FILTERS & COLOR GRADING

| # | Recommendation | Priority | Modern style it enables | FilmCraft concept borrowed |
|---|----------------|----------|-------------------------|----------------------------|
| F1 | **Bloom / Glow post effect** (bright-pass + blur + additive screen) for backgrounds & text halos | **P0** | Dreamy pop/indie videos, "heavenly" choruses | Lights & Blurs (glow, lens_blur) |
| F2 | **Halation** (warm orange glow around highlights, film-scan look) | P1 | Vintage film / A24 aesthetic | Film Emulation presets |
| F3 | **Chromatic aberration** (RGB channel offset, edge-weighted) | **P0** | Edgy trap/rock, glitch beats | Grunge & Distort (glitch params) |
| F4 | **Speed ramp / time remap** control on background video (ease curves) | P1 | Beat-drop slowdowns, trending CapCut style | time_remap effect + keyframe curves |
| F5 | **Blend modes** on background/overlay layers: multiply, screen, overlay, soft-light, color-dodge (min 6) | **P0** | Double-exposure lyric videos | 15 blend-mode registry |
| F6 | **Gradient / LUT-based looks** replacing pure CSS filters: ship 6-10 .cube LUTs (Kodak 2383, Fuji 3510, bleach bypass, cross-process) via WebGL or Python colour math | **P1** | Cinematic grades used by top lyric channels | Lumetri look + presets with param sets |
| F7 | **Parametric color wheels UI** (shadow/midtone/highlight tint + exposure + contrast + saturation) - CSS approximation in preview, exact math in Python render | **P1** | Full creative control (pro users) | Lumetri color wheels |
| F8 | **HSL secondary** (hue range isolate -> recolor, e.g. keep only red neon) | P2 | Selective color pop | Lumetri HSL secondary |
| F9 | **Beat-synced filter pulses** (filter intensity/brightness kicks on detected beats) | **P0** | Every trending beat-driven lyric video | (lyric-specific; none in FilmCraft) |
| F10 | **Depth-of-field / rack focus** (radial blur mask following a focus point) | P2 | Cinematic depth | lens_blur + masks |
| F11 | **Film gate weave + jitter** (tiny random translate/rotate, 8-12 fps stepped) | P1 | Authentic 8mm/16mm | Film Emulation |
| F12 | **Noise/grain with controls** (monochrome toggle, size, intensity, animated) | P1 | Film texture | noise effect |

### 4.2 TRANSITIONS (per lyric line + scene)

Current: 12. Target: ~30 with parameters. Modern lyric videos cut on beats - transitions
need to be punchy, short (0.15-0.4 s), and parameterizable.

| # | Recommendation | Priority | Notes / FilmCraft reference |
|---|----------------|----------|------------------------------|
| T1 | **Whip pan** (directional motion blur slide, 80% blur default) | **P0** | FilmCraft whip (blur param) - THE trending transition |
| T2 | **Zoom blur / Cross zoom** (radial streak zoom into next line) | **P0** | FilmCraft cross_zoom, zoom_blur (strength, center) |
| T3 | **Spring / Pop motion** (overshoot bounce in from direction) | **P0** | FilmCraft pop_motion (overshoot), spring_motion |
| T4 | **Glitch w/ params** (RGB split px, block size, scanline count, seed) | **P0** | Upgrade current glitch-dissolve to full param set |
| T5 | **Dip to Color** (arbitrary color, not just black/white) | **P1** | FilmCraft dip_to_color |
| T6 | **Shape Flow reveal** (circle/square/diamond/star/heart/hexagon wipe) | **P1** | FilmCraft shape_flow SHAPE_OPTS |
| T7 | **Clock wipe** (radial sweep w/ center + start angle) | **P1** | FilmCraft clock_wipe |
| T8 | **Morph cut / soft morph** (blurred cross-dissolve with slight warp) | **P1** | FilmCraft morph_cut |
| T9 | **Kaleidoscope burst** (segment mirror flash on drop) | P2 | FilmCraft kaleidoscope |
| T10 | **TV Power-off** (CRT collapse to line then black) | P2 | FilmCraft tv_power (glow color) |
| T11 | **VHS damage splice** (tracking noise bar + roll) | P2 | FilmCraft vhs_damage |
| T12 | **Slices / Louver** (screen splits into N strips offset alternating) | P2 | FilmCraft slice, louver (slices/slats count) |
| T13 | **3D Spin w/ perspective** | P2 | FilmCraft spin_3d (perspective param) |
| T14 | **Universal transition params:** duration (exists), direction (add N/E/S/W), feather, motion-blur amount, custom color for dips, random seed | **P0** | Every FilmCraft transition exposes these |
| T15 | **Transition-on-beat helper:** auto-snap transition start to nearest detected beat | **P1** | Lyric-video-specific |

---

### 4.3 TEXT ANIMATIONS (kinetic typography engine)

Current: 5 line-level styles. Modern lyric videos animate at **word** and **character**
granularity with spring physics. This is the single highest-impact area.

| # | Recommendation | Priority | Details / FilmCraft reference |
|---|----------------|----------|-------------------------------|
| A1 | **Spring/elastic physics engine** (critically damped spring for scale/translate/rotate; expose damping, stiffness, mass) - replaces hand-tuned cubic-beziers | **P0** | Enables all bounce/overshoot styles below |
| A2 | **Per-word entrance animations:** pop-scale, slide-up-blur, rotate-in, flip-up, drop-in-with-bounce | **P0** | Word-level granularity (karaoke already splits words) |
| A3 | **Per-character stagger:** chars animate in sequence with configurable stagger ms (wave, raindrop, random-order modes) | **P0** | FilmCraft text_animator (columns) + char style runs |
| A4 | **Karaoke gradient fill wipe** (horizontal gradient mask sweeping across active word instead of flat color swap) - the #1 modern lyric style | **P0** | (lyric-specific; FilmCraft caption wipe analogous) |
| A5 | **Beat-punch emphasis** (active word scale 1.0->1.12->1.0 on beat with spring) | **P0** | Beat-synced; extend existing scale(1.06) pop |
| A6 | **Blur-in / focus-in** (filter blur 12px->0 + opacity on entrance) | **P0** | Modern "rack focus text" style |
| A7 | **Letter-spacing animation** (tracking-in from wide->normal on entrance) | **P1** | FilmCraft per-char tracking style runs |
| A8 | **3D rotate-in** (rotateX/rotateY with perspective, e.g. flip-up, swing) | **P1** | FilmCraft rolls + 3D transforms |
| A9 | **Ghost/echo trail** (2-3 delayed opacity copies behind active text during fast motion) | **P1** | Motion-blur approximation (FilmCraft has true motion blur) |
| A10 | **Text on path / arc** (curved baseline for choruses) | P2 | Advanced shaping - longer term |
| A11 | **Handwritten draw-on** (SVG stroke-dashoffset reveal for script fonts) | **P1** | Indie/acoustic trend; needs SVG text path |
| A12 | **Masked reveal** (sliding gradient/rect mask exposing text) | **P1** | FilmCraft text masks + soft_wipe |
| A13 | **Variable-font weight animation** (weight 200->900 over entrance) | P2 | Requires variable fonts (see 4.4) |
| A14 | **Exit animations** (currently lines just scroll away): fade-out-up, blur-out, scale-out, typewriter-delete | **P1** | Every modern editor has intro+outro per line |
| A15 | **Motion blur on fast text** (approximate with directional blur filter during high-velocity frames) | **P1** | FilmCraft transitions all expose motion_blur |
| A16 | **Per-line entrance/override** on LyricClip (like LyricClip.transition already does for transitions) | **P0** | Structural: extend LyricClip with entrance_style, exit_style |
| A17 | **Easing library exposure** (let users pick ease-out-back, ease-out-elastic, ease-out-expo per animation) | **P1** | Param parity with FilmCraft curves |

### 4.4 FONT STYLES

Current: Arial hardcoded. This is the most visible "non-modern" aspect.

| # | Recommendation | Priority | Details / FilmCraft reference |
|---|----------------|----------|-------------------------------|
| N1 | **Bundle a curated webfont library** (self-hosted OFL fonts, no CDN dependency): Inter (sans default), **Anton** & **Bebas Neue** (condensed impact - trap/hip-hop), **Oswald** (condensed), **Montserrat** (geometric pop), **Playfair Display** (serif elegance), **Caveat / Permanent Marker** (handwritten), **JetBrains Mono** (lo-fi/tech), **Noto Serif** | **P0** | FilmCraft bundles OFL Inter/JetBrainsMono/NotoSerif - proven licensing-safe set |
| N2 | **Font picker UI** in Text tab with live preview thumbnails rendered from the actual font | **P0** | FilmCraft fonts.rs face database + family/style resolution |
| N3 | **Weight & style controls** (font-weight 100-900 where available, italic toggle) | **P0** | FilmCraft faux bold/italic + real style resolution |
| N4 | **Per-word/per-line font override** (e.g. emphasized word in different family) | P2 | FilmCraft per-character StyleRun |
| N5 | **Google Fonts import option** (user pastes font URL; cached) as escape hatch | P2 | Beyond FilmCraft (it scans system fonts) |
| N6 | **Deterministic font embedding in Python render** (bundle TTF/OTF files, register with Pillow) so renders match preview exactly | **P0** | Fixes preview<->render divergence |
| N7 | **Text transform controls:** uppercase / small-caps / capitalize presets | **P1** | FilmCraft Caps in TextStyle |
| N8 | **Baseline shift (superscript/subscript) + underline/strikethrough toggles** | P2 | FilmCraft per-char styles |
| N9 | **Variable font axis control** (weight + width sliders) for fonts that support it | P2 | Modern typography trend |

### 4.5 AMBIENT ANIMATION LAYER (particles & camera)

Current: ambient_particles enum (none/starfield/dust-motes/audio-pulse) exists in
Theme but is barely surfaced. Modern videos always have an animated ambience layer.

| # | Recommendation | Priority | Details |
|---|----------------|----------|---------|
| P1a | **Audio-reactive camera** (background scale 1.0-1.06 driven by bass energy; slight rotation sway) | **P0** | Universal modern lyric-video staple |
| P1b | **Particle systems v2:** bokeh circles, snow, embers/sparks, petals, film dust w/ parallax layers | **P1** | Extend ambient_particles |
| P1c | **Light rays / god rays** from a movable source (volumetric streaks) | **P1** | FilmCraft ray transition (length, center) |
| P1d | **Floating lyrics parallax** (inactive lines drift slower than active on scroll) | **P1** | Depth feel |
| P1e | **Shake on beat** (camera translate jitter w/ decay envelope) | **P0** | FilmCraft earthquake (shake param) |
| P1f | **Vignette pulse** (breathing vignette synced to BPM) | P2 | |

---

## 5. Implementation Plan

### Phase 0 - Foundations (enables everything else)
1. **Extend Theme type** (web/src/types/index.ts):
   - entrance_animation, exit_animation, word_animation, char_stagger_ms,
     spring_damping/stiffness/mass, karaoke_fill: 'flat' | 'gradient',
     blend_mode, bloom_enabled/bloom_intensity, chromatic_aberration,
     camera_shake/beat_punch booleans, font_weight, font_style, text_transform.
2. **Extend LyricClip**: entrance_style?, exit_style? (per-line overrides).
3. **Create web/src/lib/animations.ts** - central animation registry mirroring
   FilmCraft's EffectDef pattern: { id, name, category, tag, params[], cssBuilder() }
   so Motion/Text tabs render from data (like TRANSITIONS_CATALOG already does).
4. **Bundle fonts** into web/public/fonts/ + @font-face in index.css; mirror into
   src/render/fonts/ for Python (N1, N6).

### Phase 1 - Highest-Impact Modern Styles (P0 items)
- **Text (A1-A6, A16):** spring physics hook (useSpring), per-word entrances,
  char stagger, karaoke gradient fill, beat-punch, blur-in, per-clip overrides.
- **Transitions (T1-T4, T14):** whip pan, zoom blur, spring motion, parametrized
  glitch + direction/feather/blur params for all existing transitions.
- **Filters (F1, F3, F5, F9):** bloom layer, chromatic aberration overlay, blend-mode
  select, beat-synced intensity pulses (hook to existing audio analysis in Dashboard).
- **Fonts (N1, N2, N3, N6):** bundled OFL set + picker + weights + Python embedding.
- **Ambient (P1a, P1e):** audio-reactive camera scale + beat shake.

### Phase 2 - Depth (P1 items)
- Halation, speed ramps, LUT looks (F2, F4, F6, F7, F11, F12).
- Dip-to-color, shape-flow, clock wipe, morph cut (T5-T8).
- Tracking animation, 3D rotate-in, ghost trails, draw-on, masked reveal, exit
  animations, motion blur, easing picker (A7-A12, A14, A15, A17).
- Text transform, particles v2, light rays, parallax (N7, P1b-P1d).

### Phase 3 - Pro Polish (P2 items)
- HSL secondary, DOF, per-char fonts, text-on-path, variable fonts, kaleidoscope,
  TV power, VHS splice, slices/louver, 3D spin, vignette pulse (F8, F10, N4, N8, N9,
  A13, T9-T13, P1f).

### Rendering parity (parallel track)
For each web-side effect, mirror the math in Python (src/animations/, new
src/render/filters.py): CSS filter matrices -> Pillow/numpy equivalents; clip-path
transitions -> per-frame alpha masks; spring physics -> same integrator in Python.
**Rule: no effect ships in the dashboard unless the Python renderer supports it**
(prevents the current scroll-only divergence).

### Suggested file touchpoints
| File | Change |
|------|--------|
| web/src/types/index.ts | Theme/LyricClip fields; new catalogs (TEXT_ANIMATIONS, FONT_LIBRARY, BLEND_MODES) |
| web/src/lib/animations.ts | new - animation registry + spring math |
| web/src/lib/fonts.ts | new - font metadata + @font-face registration |
| web/src/components/dashboard/StudioDrawer.tsx | Motion/Text/Fonts tabs render from catalogs |
| web/src/pages/Dashboard.tsx | render loop: entrances, karaoke gradient, beat hooks, bloom/CA layers |
| web/src/pages/Dashboard.css | compositor layers for bloom/CA/blend modes; keyframes |
| src/animations/*.py | port each text animation for final render |
| src/render/filters.py | new - Python filter/LUT/bloom implementations |
| src/core/theme_loader.py | new theme fields + font resolution |

---

## 6. Modern Style Reference (what top 2024-2026 lyric videos use)

| Genre | Typical combo |
|-------|---------------|
| Pop / Indie | Montserrat/Inter + karaoke gradient fill + bloom + soft dust particles + gentle camera breathe |
| Trap / Hip-hop | Anton/Bebas condensed uppercase + per-char stagger raindrop + beat punch + chromatic aberration + shake on 808 + glitch on drops |
| Lo-fi | Caveat handwritten draw-on + film grain + gate weave + sepia/faded print + slow parallax |
| EDM / Festival | Zoom-punch transitions + strobe flash on beats + neon glow + light rays + spring pop words |
| Cinematic ballad | Playfair serif + blur-in focus + dip-to-black between stanzas + teal-orange grade + halation |
| Cyberpunk / Hyperpop | JetBrains Mono + RGB-split glitch + VHS damage + CRT scanlines + spring motion + phosphor green grade |

---

## 7. Success Criteria
1. >= 25 transitions with direction/feather/blur params (currently 12, no params).
2. >= 10 text entrance + 5 exit animations at word & char granularity.
3. >= 12 bundled OFL fonts with weight control + picker UI.
4. >= 20 filters/grades incl. bloom, chromatic aberration, >= 6 blend modes, beat-reactive.
5. Every dashboard effect has Python render parity (zero divergence).
6. All new fields backward-compatible (old .json themes keep working via DEFAULTS merge).

---

## 8. References
- FilmCraft source (this repo): filmcraft-main/filmcraft-main/crates/
  - project/effect.rs - effect registry + param system
  - project/vtransition.rs - 84 transitions w/ params
  - project/graphic_design.rs - per-char style runs, rolls/crawls
  - render/lumetri_presets.rs - color-grade preset pattern
  - render/effects.rs, render/blend.rs, render/mask.rs - pixel implementations
  - text/fonts.rs, text/layout.rs, text/mask.rs - text engine
- Our code: web/src/types/index.ts, web/src/pages/Dashboard.tsx,
  web/src/components/dashboard/StudioDrawer.tsx, src/animations/scroll.py
