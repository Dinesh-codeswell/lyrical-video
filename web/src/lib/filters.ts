export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'color-dodge'
  | 'difference';

export const BLEND_MODES: { id: BlendMode; label: string; tag: string }[] = [
  { id: 'normal', label: 'Normal', tag: 'BASE' },
  { id: 'multiply', label: 'Multiply', tag: 'DARK' },
  { id: 'screen', label: 'Screen', tag: 'LIGHT' },
  { id: 'overlay', label: 'Overlay', tag: 'CONTRAST' },
  { id: 'soft-light', label: 'Soft Light', tag: 'SOFT' },
  { id: 'color-dodge', label: 'Color Dodge', tag: 'BRIGHT' },
  { id: 'difference', label: 'Difference', tag: 'MATRIX' },
];

export type FilterEffectType =
  | 'none'
  | 'bloom'
  | 'chromatic-aberration'
  | 'halation'
  | 'grain'
  | 'gate-weave'
  | 'light-leak'
  | 'vignette-pulse'
  | 'vhs-damage';

export interface FilterEffect {
  id: FilterEffectType;
  name: string;
  category: 'color' | 'texture' | 'light' | 'retro';
  tag: string;
  description: string;
  previewGradient: string;
}

export const FILTER_EFFECTS: FilterEffect[] = [
  {
    id: 'none',
    name: 'None',
    category: 'color',
    tag: 'RAW',
    description: 'No extra post effect',
    previewGradient: 'linear-gradient(135deg, #2b2b2b, #151515)',
  },
  {
    id: 'bloom',
    name: 'Bloom / Glow',
    category: 'light',
    tag: 'HALATION',
    description: 'Soft additive glow on highlights for dreamy choruses',
    previewGradient: 'radial-gradient(circle at center, rgba(255,255,255,0.5), transparent 70%)',
  },
  {
    id: 'chromatic-aberration',
    name: 'Chromatic Aberration',
    category: 'retro',
    tag: 'RGB SPLIT',
    description: 'RGB channel edge offset for edgy trap/rock/glitch beats',
    previewGradient: 'linear-gradient(135deg, #ff0055, #00f2fe, #aa3bff)',
  },
  {
    id: 'halation',
    name: 'Halation',
    category: 'texture',
    tag: 'FILM SCAN',
    description: 'Warm orange highlight glow, vintage film/A24 look',
    previewGradient: 'radial-gradient(circle at center, rgba(255,140,40,0.35), transparent 70%)',
  },
  {
    id: 'grain',
    name: 'Film Grain',
    category: 'texture',
    tag: 'TEXTURE',
    description: 'Animated monochrome film grain with intensity control',
    previewGradient: 'linear-gradient(135deg, #3f3f46, #71717a)',
  },
  {
    id: 'gate-weave',
    name: 'Film Gate Weave',
    category: 'retro',
    tag: 'JITTER',
    description: 'Tiny stepped camera jitter for 8mm/16mm authenticity',
    previewGradient: 'linear-gradient(135deg, #1c1917, #0c0a09)',
  },
  {
    id: 'light-leak',
    name: 'Light Leak',
    category: 'light',
    tag: 'OPTICAL',
    description: 'Warm projector-style light leak across the frame',
    previewGradient: 'linear-gradient(135deg, rgba(255,220,100,0.5), rgba(255,120,40,0.3), transparent)',
  },
  {
    id: 'vignette-pulse',
    name: 'Vignette Pulse',
    category: 'light',
    tag: 'BREATHE',
    description: 'Breathing vignette synced to tempo',
    previewGradient: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
  },
  {
    id: 'vhs-damage',
    name: 'VHS Damage',
    category: 'retro',
    tag: 'DAMAGE',
    description: 'Tracking noise bar + roll for VHS splice look',
    previewGradient: 'linear-gradient(135deg, #06b6d4, #f43f5e)',
  },
];

export function getFilterEffect(id: FilterEffectType): FilterEffect | undefined {
  return FILTER_EFFECTS.find((e) => e.id === id);
}
