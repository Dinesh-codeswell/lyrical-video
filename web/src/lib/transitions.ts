export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'wipe-left'
  | 'wipe-right'
  | 'iris-wipe'
  | 'diagonal-slash'
  | 'dip-black'
  | 'dip-color'
  | 'flash-white'
  | 'glitch-dissolve'
  | 'slide-up'
  | 'push-left'
  | 'zoom-punch'
  | 'light-leak'
  | 'whip-pan'
  | 'zoom-blur'
  | 'spring-pop'
  | 'glitch-damage'
  | 'shape-circle'
  | 'shape-square'
  | 'shape-diamond'
  | 'clock-wipe'
  | 'morph-soft';

export type TransitionCategory = 'dissolve' | 'wipe' | 'motion' | 'light' | 'shape' | 'grunge';

export interface TransitionParamDef {
  key: string;
  label: string;
  type: 'number' | 'color' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  default?: number | string;
  options?: { value: string; label: string }[];
}

export interface VideoTransition {
  id: TransitionType;
  name: string;
  category: TransitionCategory;
  tag: string;
  description: string;
  previewClass: string;
  params?: TransitionParamDef[];
}

export const TRANSITIONS_CATALOG: VideoTransition[] = [
  {
    id: 'crossfade',
    name: 'Standard Crossfade',
    category: 'dissolve',
    tag: 'DISSOLVE',
    description: 'Smooth alpha opacity blend between clips and lyric lines',
    previewClass: 'preview-crossfade',
  },
  {
    id: 'dip-black',
    name: 'Dip to Black',
    category: 'dissolve',
    tag: 'CLASSIC',
    description: 'Fades down to pure black, then lifts smoothly into the next line',
    previewClass: 'preview-dip-black',
  },
  {
    id: 'dip-color',
    name: 'Dip to Color',
    category: 'dissolve',
    tag: 'COLOR',
    description: 'Dips to an arbitrary color before lifting into the next line',
    previewClass: 'preview-dip-color',
    params: [
      { key: 'dip_color', label: 'Color', type: 'color', default: '#000000' },
    ],
  },
  {
    id: 'flash-white',
    name: 'Flash to White',
    category: 'dissolve',
    tag: 'IMPACT',
    description: 'High-energy white flash burst for powerful beat drops and hooks',
    previewClass: 'preview-flash-white',
  },
  {
    id: 'glitch-dissolve',
    name: 'Digital Glitch Dissolve',
    category: 'grunge',
    tag: 'CYBER',
    description: 'RGB chromatic shift and horizontal scanline pixel tearing',
    previewClass: 'preview-glitch-dissolve',
    params: [
      { key: 'rgb_split_px', label: 'RGB Split', type: 'number', min: 0, max: 20, step: 1, default: 6 },
      { key: 'scanlines', label: 'Scanlines', type: 'number', min: 0, max: 20, step: 1, default: 4 },
    ],
  },
  {
    id: 'glitch-damage',
    name: 'VHS Glitch Damage',
    category: 'grunge',
    tag: 'DAMAGE',
    description: 'RGB split, block tearing, and tracking noise with seed control',
    previewClass: 'preview-glitch-damage',
    params: [
      { key: 'rgb_split_px', label: 'RGB Split', type: 'number', min: 0, max: 24, step: 1, default: 10 },
      { key: 'block_size', label: 'Block Size', type: 'number', min: 4, max: 64, step: 2, default: 18 },
      { key: 'scanlines', label: 'Scanlines', type: 'number', min: 0, max: 24, step: 1, default: 6 },
      { key: 'seed', label: 'Seed', type: 'number', min: 0, max: 9999, step: 1, default: 7 },
    ],
  },
  {
    id: 'wipe-left',
    name: 'Linear Wipe Left',
    category: 'wipe',
    tag: 'WIPE',
    description: 'Clean linear boundary sweep cutting from right to left',
    previewClass: 'preview-wipe-left',
    params: [
      { key: 'direction', label: 'Direction', type: 'choice', default: 'left', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]},
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 6 },
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 0 },
    ],
  },
  {
    id: 'wipe-right',
    name: 'Linear Wipe Right',
    category: 'wipe',
    tag: 'WIPE',
    description: 'Broadcast style horizontal wipe from left to right',
    previewClass: 'preview-wipe-right',
    params: [
      { key: 'direction', label: 'Direction', type: 'choice', default: 'right', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]},
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 6 },
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 0 },
    ],
  },
  {
    id: 'iris-wipe',
    name: 'Radial Iris / Circle',
    category: 'wipe',
    tag: 'MASK',
    description: 'Expanding circular aperture mask revealing the next line',
    previewClass: 'preview-iris-wipe',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 8 },
    ],
  },
  {
    id: 'diagonal-slash',
    name: 'Diagonal Slash Wipe',
    category: 'wipe',
    tag: 'ANGULAR',
    description: 'Dynamic 45-degree angular slice across the screen',
    previewClass: 'preview-diagonal-slash',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
    ],
  },
  {
    id: 'slide-up',
    name: 'Vertical Slide Up',
    category: 'motion',
    tag: 'PUSH',
    description: 'Smooth vertical momentum slide elevating into frame',
    previewClass: 'preview-slide-up',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 20 },
    ],
  },
  {
    id: 'push-left',
    name: 'Horizontal Push',
    category: 'motion',
    tag: 'PUSH',
    description: 'Incoming clip actively shoves previous content offscreen',
    previewClass: 'preview-push-left',
    params: [
      { key: 'direction', label: 'Direction', type: 'choice', default: 'left', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]},
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 35 },
    ],
  },
  {
    id: 'zoom-punch',
    name: 'Zoom Punch / Scale',
    category: 'motion',
    tag: 'KINETIC',
    description: 'Dramatic camera focal zoom in with rapid settle',
    previewClass: 'preview-zoom-punch',
    params: [
      { key: 'zoom', label: 'Zoom', type: 'number', min: 1.0, max: 2.0, step: 0.05, default: 1.35 },
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 30 },
    ],
  },
  {
    id: 'light-leak',
    name: 'Prism Light Leak Flash',
    category: 'light',
    tag: 'ORGANIC',
    description: 'Warm 35mm projector light flare cutting through the cut',
    previewClass: 'preview-light-leak',
  },
  {
    id: 'whip-pan',
    name: 'Whip Pan',
    category: 'motion',
    tag: 'WHIP',
    description: 'Directional motion-blur slide with strong blur smear',
    previewClass: 'preview-whip-pan',
    params: [
      { key: 'direction', label: 'Direction', type: 'choice', default: 'right', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]},
      { key: 'motion_blur', label: 'Motion Blur', type: 'number', min: 0, max: 100, step: 5, default: 80 },
      { key: 'overshoot', label: 'Overshoot', type: 'number', min: 0, max: 1, step: 0.05, default: 0.12 },
    ],
  },
  {
    id: 'zoom-blur',
    name: 'Zoom Blur / Cross Zoom',
    category: 'motion',
    tag: 'ZOOM',
    description: 'Radial streak zoom into the next line with blur streak',
    previewClass: 'preview-zoom-blur',
    params: [
      { key: 'zoom', label: 'Zoom', type: 'number', min: 1.0, max: 2.5, step: 0.05, default: 1.8 },
      { key: 'motion_blur', label: 'Blur Strength', type: 'number', min: 0, max: 100, step: 5, default: 70 },
    ],
  },
  {
    id: 'spring-pop',
    name: 'Spring / Pop Motion',
    category: 'motion',
    tag: 'SPRING',
    description: 'Overshoot bounce in from a direction with settle',
    previewClass: 'preview-spring-pop',
    params: [
      { key: 'direction', label: 'Direction', type: 'choice', default: 'up', options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' },
      ]},
      { key: 'overshoot', label: 'Overshoot', type: 'number', min: 0, max: 1, step: 0.05, default: 0.18 },
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 2 },
    ],
  },
  {
    id: 'shape-circle',
    name: 'Circle Reveal',
    category: 'shape',
    tag: 'SHAPE',
    description: 'Expanding circle mask revealing the next line',
    previewClass: 'preview-shape-circle',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 6 },
    ],
  },
  {
    id: 'shape-square',
    name: 'Square Reveal',
    category: 'shape',
    tag: 'SHAPE',
    description: 'Expanding square mask revealing the next line',
    previewClass: 'preview-shape-square',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
    ],
  },
  {
    id: 'shape-diamond',
    name: 'Diamond Reveal',
    category: 'shape',
    tag: 'SHAPE',
    description: 'Rotating diamond wipe revealing the next line',
    previewClass: 'preview-shape-diamond',
    params: [
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
    ],
  },
  {
    id: 'clock-wipe',
    name: 'Clock Wipe',
    category: 'wipe',
    tag: 'RADIAL',
    description: 'Radial sweep from a center point with start angle control',
    previewClass: 'preview-clock-wipe',
    params: [
      { key: 'start_angle', label: 'Start Angle', type: 'number', min: 0, max: 360, step: 5, default: 0 },
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 4 },
    ],
  },
  {
    id: 'morph-soft',
    name: 'Soft Morph',
    category: 'dissolve',
    tag: 'MORPH',
    description: 'Blurred cross-dissolve with slight warp for a smooth morph',
    previewClass: 'preview-morph-soft',
    params: [
      { key: 'blur', label: 'Warp Blur', type: 'number', min: 0, max: 40, step: 1, default: 12 },
      { key: 'feather', label: 'Feather', type: 'number', min: 0, max: 40, step: 1, default: 6 },
    ],
  },
];

export function getTransitionById(id: TransitionType): VideoTransition | undefined {
  return TRANSITIONS_CATALOG.find((t) => t.id === id);
}

export const TRANSITION_DIRECTIONS: { value: TransitionDirection; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
];
