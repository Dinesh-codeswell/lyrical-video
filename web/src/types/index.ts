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
}

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
}

export interface LyricClip {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
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
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    category: 'color',
    tag: 'HYPER GLOW',
    description: 'High-contrast electric cyan and saturated ultraviolet hues',
    cssFilter: 'contrast(1.3) saturate(1.75) hue-rotate(180deg)',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #ec4899)',
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
  },
  {
    id: 'vhs-glitch',
    name: 'VHS Retro Tape',
    category: 'retro',
    tag: 'CRT GLITCH',
    description: 'Analog video tape scanlines, chromatic RGB shift and tracking flutter',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #f43f5e)',
  },
  {
    id: 'crt-monitor',
    name: 'CRT Arcade Scanlines',
    category: 'retro',
    tag: 'RASTER',
    description: 'Cathode-ray tube phosphor scanlines and retro monitor curvature',
    previewGradient: 'linear-gradient(135deg, #10b981, #064e3b)',
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


