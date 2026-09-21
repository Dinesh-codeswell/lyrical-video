export interface Theme {
  name: string;
  background_color: string;
  text_color: string;
  active_text_color: string;
  active_text_bold: boolean;
  active_text_glow: boolean;
  active_glow_color: string | null;
  active_font_family: string | null;
  active_text_stroke_color: string;
  active_text_stroke_width: number;
  inactive_text_opacity_gradient: number[];
  font_family: string;
  font_size: number;
  letter_spacing: number;
  line_spacing: number;
  lyric_position: 'left' | 'center' | 'right';
  highlight_mode: 'line' | 'word' | 'character';
  highlight_dim_alpha: number;
  text_overlay_opacity: number;
  text_overlay_color: string;
  column_width: number;
  logo_path: string;
  logo_width: number;
  logo_h_align: 'left' | 'center' | 'right';
  title_h_align: 'left' | 'center' | 'right';
  
  // Advanced Animation & Canvas
  animation_style: 'scroll' | 'fade' | 'slide' | 'kinetic' | 'typewriter';
  animation_speed: number; // 0.1 to 2.0 multiplier
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
  fps: 24 | 30 | 60;

  // Visual Effects & Open-Source Shaders
  active_filter: VideoFilterType;
  filter_intensity: number; // 0 to 100
  ambient_particles: AmbientParticleType;
  vignette_enabled: boolean;

  // Transitions System (OpenShot Mask / Wipe & Dissolves)
  active_transition: TransitionType;
  transition_duration: number; // 0.2 to 2.0 seconds

  // OpenShot-Inspired Advanced VFX Engine (Phase 2)
  background_blur: number; // 0 to 30 px (Gaussian Defocus)
  letterbox_bars: 'none' | '2.39:1' | '1.85:1' | '4:3';
  letterbox_color: string;
  pixelate_enabled: boolean;
  pixelate_block_size: number; // 2 to 48 px
  wave_enabled: boolean;
  wave_amplitude: number; // 0 to 50
  wave_speed: number; // 0.2 to 3.0
  chroma_key_enabled: boolean;
  chroma_key_color: string;
  chroma_key_fuzz: number; // 10 to 80
}

export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'wipe-left'
  | 'wipe-right'
  | 'iris-wipe'
  | 'diagonal-slash'
  | 'dip-black'
  | 'flash-white'
  | 'glitch-dissolve'
  | 'slide-up'
  | 'push-left'
  | 'zoom-punch'
  | 'light-leak';

export interface VideoTransition {
  id: TransitionType;
  name: string;
  category: 'dissolve' | 'wipe' | 'motion' | 'light';
  tag: string;
  description: string;
  previewClass: string;
}

export const TRANSITIONS_CATALOG: VideoTransition[] = [
  {
    id: 'crossfade',
    name: 'Standard Crossfade',
    category: 'dissolve',
    tag: 'DISSOLVE',
    description: 'Smooth alpha opacity blend between clips and lyric lines',
    previewClass: 'preview-crossfade'
  },
  {
    id: 'dip-black',
    name: 'Dip to Black',
    category: 'dissolve',
    tag: 'CLASSIC',
    description: 'Fades down to pure black, then lifts smoothly into the next line',
    previewClass: 'preview-dip-black'
  },
  {
    id: 'flash-white',
    name: 'Flash to White',
    category: 'dissolve',
    tag: 'IMPACT',
    description: 'High-energy white flash burst for powerful beat drops and hooks',
    previewClass: 'preview-flash-white'
  },
  {
    id: 'glitch-dissolve',
    name: 'Digital Glitch Dissolve',
    category: 'dissolve',
    tag: 'CYBER',
    description: 'RGB chromatic shift and horizontal scanline pixel tearing',
    previewClass: 'preview-glitch-dissolve'
  },
  {
    id: 'wipe-left',
    name: 'Linear Wipe Left',
    category: 'wipe',
    tag: 'WIPE',
    description: 'Clean linear boundary sweep cutting from right to left',
    previewClass: 'preview-wipe-left'
  },
  {
    id: 'wipe-right',
    name: 'Linear Wipe Right',
    category: 'wipe',
    tag: 'WIPE',
    description: 'Broadcast style horizontal wipe from left to right',
    previewClass: 'preview-wipe-right'
  },
  {
    id: 'iris-wipe',
    name: 'Radial Iris / Circle',
    category: 'wipe',
    tag: 'MASK',
    description: 'Expanding circular aperture mask revealing the next line',
    previewClass: 'preview-iris-wipe'
  },
  {
    id: 'diagonal-slash',
    name: 'Diagonal Slash Wipe',
    category: 'wipe',
    tag: 'ANGULAR',
    description: 'Dynamic 45-degree angular slice across the screen',
    previewClass: 'preview-diagonal-slash'
  },
  {
    id: 'slide-up',
    name: 'Vertical Slide Up',
    category: 'motion',
    tag: 'PUSH',
    description: 'Smooth vertical momentum slide elevating into frame',
    previewClass: 'preview-slide-up'
  },
  {
    id: 'push-left',
    name: 'Horizontal Push',
    category: 'motion',
    tag: 'PUSH',
    description: 'Incoming clip actively shoves previous content offscreen',
    previewClass: 'preview-push-left'
  },
  {
    id: 'zoom-punch',
    name: 'Zoom Punch / Scale',
    category: 'motion',
    tag: 'KINETIC',
    description: 'Dramatic camera focal zoom in with rapid settle',
    previewClass: 'preview-zoom-punch'
  },
  {
    id: 'light-leak',
    name: 'Prism Light Leak Flash',
    category: 'light',
    tag: 'ORGANIC',
    description: 'Warm 35mm projector light flare cutting through the cut',
    previewClass: 'preview-light-leak'
  }
];

export type VideoFilterType = 
  | 'none'
  | 'teal-orange'
  | 'vintage-1977'
  | 'silver-noir'
  | 'pastel-dream'
  | 'cyberpunk-neon'
  | 'sunset-gold'
  | 'film-grain'
  | 'vhs-glitch'
  | 'crt-monitor'
  | 'liquid-wave'
  | 'pixelate-mosaic'
  | 'cinematic-vignette'
  | 'prism-leak';

export type AmbientParticleType =
  | 'none'
  | 'starfield'
  | 'dust-motes'
  | 'audio-pulse';

export interface VisualEffect {
  id: VideoFilterType;
  name: string;
  category: 'color' | 'texture' | 'retro';
  tag: string;
  description: string;
  cssFilter?: string;
  previewGradient: string;
  previewImage?: string;
}

export interface LyricClip {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  transition?: TransitionType;
  transition_duration?: number;
}

export interface Marker {
  id?: string;
  time: number;
  text: string;
  color?: string;
}

export const DEFAULTS: Theme = {
  name: "Default",
  background_color: "#1a1a1a",
  text_color: "#ffffff",
  active_text_color: "#D66E31",
  active_text_bold: false,
  active_text_glow: true,
  active_glow_color: null,
  active_font_family: null,
  active_text_stroke_color: "#6A1E22",
  active_text_stroke_width: 3,
  inactive_text_opacity_gradient: [0.6, 0.4, 0.2],
  font_family: "Arial",
  font_size: 72,
  letter_spacing: 0,
  line_spacing: 1.5,
  lyric_position: "center",
  highlight_mode: "line",
  highlight_dim_alpha: 0.3,
  text_overlay_opacity: 0,
  text_overlay_color: "#000000",
  column_width: 1760,
  logo_path: "",
  logo_width: 400,
  logo_h_align: "center",
  title_h_align: "center",
  
  // Animation Defaults
  animation_style: "scroll",
  animation_speed: 1.0,
  aspect_ratio: "16:9",
  fps: 30,

  // Visual Effects & Open-Source Shaders
  active_filter: "none",
  filter_intensity: 80,
  ambient_particles: "none",
  vignette_enabled: false,

  // Transitions System
  active_transition: "crossfade",
  transition_duration: 0.4,

  // OpenShot-Inspired Advanced VFX Engine (Phase 2)
  background_blur: 0,
  letterbox_bars: "none",
  letterbox_color: "#000000",
  pixelate_enabled: false,
  pixelate_block_size: 16,
  wave_enabled: false,
  wave_amplitude: 15,
  wave_speed: 1.0,
  chroma_key_enabled: false,
  chroma_key_color: "#00ff00",
  chroma_key_fuzz: 35,
};

export interface ThemePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  theme: Partial<Theme>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Studio Default",
    badge: "Warm",
    description: "Burnt orange highlight on dark graphite",
    theme: {
      name: "Studio Default",
      background_color: "#1a1a1a",
      text_color: "#ffffff",
      active_text_color: "#D66E31",
      active_text_bold: false,
      active_text_glow: true,
      active_glow_color: "#D66E31",
      active_text_stroke_color: "#6A1E22",
      active_text_stroke_width: 3,
      font_family: "Arial",
      font_size: 72,
      line_spacing: 1.5,
      lyric_position: "center",
      text_overlay_opacity: 0,
      text_overlay_color: "#000000",
    }
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    badge: "Futuristic",
    description: "Electric pink and glowing cyan outlines",
    theme: {
      name: "Cyberpunk Neon",
      background_color: "#0a0a14",
      text_color: "#67e8f9",
      active_text_color: "#ff007f",
      active_text_bold: true,
      active_text_glow: true,
      active_glow_color: "#00f3ff",
      active_text_stroke_color: "#00f3ff",
      active_text_stroke_width: 4,
      font_family: "Arial",
      font_size: 76,
      line_spacing: 1.6,
      lyric_position: "center",
      text_overlay_opacity: 30,
      text_overlay_color: "#050510",
    }
  },
  {
    id: "spotify_minimal",
    name: "Spotify Minimal",
    badge: "Clean",
    description: "High-contrast left-aligned modern typography",
    theme: {
      name: "Spotify Minimal",
      background_color: "#121212",
      text_color: "#71717a",
      active_text_color: "#ffffff",
      active_text_bold: true,
      active_text_glow: false,
      active_glow_color: null,
      active_text_stroke_color: "#000000",
      active_text_stroke_width: 0,
      font_family: "Inter",
      font_size: 72,
      line_spacing: 1.5,
      lyric_position: "left",
      text_overlay_opacity: 0,
      text_overlay_color: "#000000",
    }
  },
  {
    id: "sunset_warmth",
    name: "Sunset Warmth",
    badge: "Vibrant",
    description: "Golden amber text over rich velvet indigo",
    theme: {
      name: "Sunset Warmth",
      background_color: "#180e1a",
      text_color: "#fdba74",
      active_text_color: "#fbbf24",
      active_text_bold: true,
      active_text_glow: true,
      active_glow_color: "#f97316",
      active_text_stroke_color: "#831843",
      active_text_stroke_width: 2,
      font_family: "Arial",
      font_size: 74,
      line_spacing: 1.5,
      lyric_position: "center",
      text_overlay_opacity: 20,
      text_overlay_color: "#1c0b24",
    }
  },
  {
    id: "dark_trap",
    name: "Dark Trap 808",
    badge: "Aggressive",
    description: "Deep crimson bold lettering on obsidian",
    theme: {
      name: "Dark Trap 808",
      background_color: "#050505",
      text_color: "#52525b",
      active_text_color: "#ef4444",
      active_text_bold: true,
      active_text_glow: true,
      active_glow_color: "#dc2626",
      active_text_stroke_color: "#450a0a",
      active_text_stroke_width: 4,
      font_family: "Arial",
      font_size: 80,
      line_spacing: 1.4,
      lyric_position: "center",
      text_overlay_opacity: 40,
      text_overlay_color: "#000000",
    }
  },
  {
    id: "matrix_terminal",
    name: "Matrix Terminal",
    badge: "Retro",
    description: "Phosphor green monospace on terminal black",
    theme: {
      name: "Matrix Terminal",
      background_color: "#020a05",
      text_color: "#166534",
      active_text_color: "#22c55e",
      active_text_bold: true,
      active_text_glow: true,
      active_glow_color: "#4ade80",
      active_text_stroke_color: "#052e16",
      active_text_stroke_width: 2,
      font_family: "JetBrains Mono",
      font_size: 70,
      line_spacing: 1.5,
      lyric_position: "left",
      text_overlay_opacity: 15,
      text_overlay_color: "#020a05",
    }
  },
];

export const VISUAL_EFFECTS: VisualEffect[] = [
  {
    id: 'none',
    name: 'Normal (Raw)',
    category: 'color',
    tag: 'ORIGINAL',
    description: 'Clean, unprocessed original source colors',
    previewGradient: 'linear-gradient(135deg, #2b2b2b, #151515)',
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    category: 'color',
    tag: 'CINEMATIC',
    description: 'Hollywood blockbuster grade with cool shadows and warm highlights',
    cssFilter: 'contrast(1.18) saturate(1.3) hue-rotate(-12deg)',
    previewGradient: 'linear-gradient(135deg, #008080, #ff8c00)',
    previewImage: '/assets/previews/teal-orange.jpg',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    category: 'color',
    tag: 'HYPER GLOW',
    description: 'High-contrast electric cyan and saturated ultraviolet hues',
    cssFilter: 'contrast(1.3) saturate(1.75) hue-rotate(180deg)',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #ec4899)',
    previewImage: '/assets/previews/cyberpunk-neon.jpg',
  },
  {
    id: 'vintage-1977',
    name: 'Vintage 1977',
    category: 'retro',
    tag: '70S ANALOG',
    description: 'Warm analog nostalgia with soft sepia highlights and faded contrast',
    cssFilter: 'sepia(0.35) contrast(1.1) saturate(1.25) brightness(1.05)',
    previewGradient: 'linear-gradient(135deg, #d4a373, #faedcd)',
  },
  {
    id: 'silver-noir',
    name: 'Silver Noir',
    category: 'color',
    tag: 'MONOCHROME',
    description: 'Deep contrast classic monochrome with rich silver highlights',
    cssFilter: 'grayscale(1) contrast(1.35) brightness(0.95)',
    previewGradient: 'linear-gradient(135deg, #e5e5e5, #171717)',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    category: 'color',
    tag: 'BLOOM GLOW',
    description: 'Soft luminous bloom glow with lifted pastel shadows',
    cssFilter: 'contrast(0.92) brightness(1.15) saturate(1.25)',
    previewGradient: 'linear-gradient(135deg, #fbcfe8, #a7f3d0)',
  },
  {
    id: 'sunset-gold',
    name: 'Golden Hour',
    category: 'color',
    tag: 'WARM AMBER',
    description: 'Radiant amber sunset glow with rich golden radiance',
    cssFilter: 'sepia(0.2) saturate(1.45) contrast(1.1) brightness(1.05)',
    previewGradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  },
  {
    id: 'film-grain',
    name: '35mm Film Grain',
    category: 'texture',
    tag: 'ANALOG TEXTURE',
    description: 'Authentic Kodak motion picture organic film noise texture',
    previewGradient: 'linear-gradient(135deg, #3f3f46, #71717a)',
    previewImage: '/assets/previews/film-grain.jpg',
  },
  {
    id: 'vhs-glitch',
    name: 'VHS Retro Tape',
    category: 'retro',
    tag: 'CRT GLITCH',
    description: 'Analog video tape scanlines, chromatic RGB shift and tracking flutter',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #f43f5e)',
    previewImage: '/assets/previews/vhs-glitch.jpg',
  },
  {
    id: 'crt-monitor',
    name: 'CRT Arcade Scanlines',
    category: 'retro',
    tag: 'RASTER',
    description: 'Cathode-ray tube phosphor scanlines and retro monitor curvature',
    previewGradient: 'linear-gradient(135deg, #10b981, #064e3b)',
    previewImage: '/assets/previews/crt-monitor.jpg',
  },
  {
    id: 'liquid-wave',
    name: 'OpenShot Liquid Wave',
    category: 'texture',
    tag: 'OPENSHOT WAVE',
    description: 'Psychedelic fluid ripple displacement and liquid wave distortion',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #a855f7)',
    previewImage: '/assets/previews/liquid-wave.jpg',
  },
  {
    id: 'pixelate-mosaic',
    name: 'OpenShot 8-Bit Mosaic',
    category: 'retro',
    tag: 'OPENSHOT PIXEL',
    description: 'Retro 8-bit arcade mosaic block quantization shader',
    previewGradient: 'linear-gradient(135deg, #ec4899, #3b82f6)',
    previewImage: '/assets/previews/pixelate-mosaic.jpg',
  },
  {
    id: 'cinematic-vignette',
    name: 'Cinematic Vignette',
    category: 'texture',
    tag: 'OPTICAL LENS',
    description: 'Natural optical edge falloff that centers focus onto lyrics',
    previewGradient: 'radial-gradient(circle, #52525b 30%, #09090b 100%)',
  },
  {
    id: 'prism-leak',
    name: 'Prism Light Leak',
    category: 'texture',
    tag: 'LIGHT FLARE',
    description: 'Soft anamorphic rainbow light flare and floating optical streaks',
    previewGradient: 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(245,158,11,0.8), rgba(59,130,246,0.8))',
  },
];


