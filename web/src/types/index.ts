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

