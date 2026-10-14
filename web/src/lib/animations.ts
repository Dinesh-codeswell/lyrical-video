export type TextEntranceStyle =
  | 'none'
  | 'scroll'
  | 'typewriter'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'kinetic-pop'
  | 'pop-scale'
  | 'blur-in'
  | 'rotate-in'
  | 'drop-in'
  | 'wave'
  | 'raindrop'
  | 'flip-up';

export type TextExitStyle =
  | 'none'
  | 'fade-out-up'
  | 'blur-out'
  | 'scale-out'
  | 'typewriter-delete';

export type WordAnimationStyle =
  | 'none'
  | 'scale-pop'
  | 'slide-up'
  | 'blur-in';

export type AnimationStyle =
  | 'scroll'
  | 'fade'
  | 'slide'
  | 'kinetic'
  | 'typewriter';

export interface AnimationEntry {
  id: TextEntranceStyle | TextExitStyle | WordAnimationStyle | AnimationStyle;
  name: string;
  category: 'entrance' | 'exit' | 'word' | 'line';
  tag: string;
  description: string;
  cssClass: string;
  appliesOn: 'active-line' | 'active-word' | 'active-char' | 'all';
}

export const ANIMATION_CATALOG: AnimationEntry[] = [
  {
    id: 'scroll',
    name: 'Scroll',
    category: 'line',
    tag: 'CLASSIC',
    description: 'Continuous vertical roll of lyrics',
    cssClass: 'lyrics-scroller',
    appliesOn: 'all',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    category: 'line',
    tag: 'RETRO',
    description: 'Char-by-char reveal with blinking cursor',
    cssClass: 'animate-current-line typewriter-line',
    appliesOn: 'active-line',
  },
  {
    id: 'fade',
    name: 'Fade',
    category: 'line',
    tag: 'CLEAN',
    description: 'Opacity fade with subtle rise',
    cssClass: 'animate-current-line fade-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    category: 'line',
    tag: 'LATERAL',
    description: 'Lateral entrance with deceleration',
    cssClass: 'animate-current-line slide-left-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    category: 'line',
    tag: 'LATERAL',
    description: 'Lateral entrance from the right',
    cssClass: 'animate-current-line slide-right-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'kinetic-pop',
    name: 'Kinetic Pop',
    category: 'line',
    tag: 'MODERN',
    description: 'Elastic bounce-in per line',
    cssClass: 'animate-current-line kinetic-pop-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'pop-scale',
    name: 'Pop Scale',
    category: 'entrance',
    tag: 'SPRING',
    description: 'Spring-driven scale pop per line/word',
    cssClass: 'animate-current-line pop-scale-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'blur-in',
    name: 'Blur In',
    category: 'entrance',
    tag: 'FOCUS',
    description: 'Rack-focus reveal with blur collapse',
    cssClass: 'animate-current-line blur-in-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'drop-in',
    name: 'Drop In',
    category: 'entrance',
    tag: 'BOUNCE',
    description: 'Drop in with bounce settle',
    cssClass: 'animate-current-line drop-in-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'rotate-in',
    name: 'Rotate In',
    category: 'entrance',
    tag: '3D',
    description: '3D rotateX reveal with perspective',
    cssClass: 'animate-current-line rotate-in-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'flip-up',
    name: 'Flip Up',
    category: 'entrance',
    tag: '3D',
    description: 'Card flip-up reveal with perspective',
    cssClass: 'animate-current-line flip-up-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'wave',
    name: 'Wave',
    category: 'entrance',
    tag: 'STAGGER',
    description: 'Per-char sequential wave entrance',
    cssClass: 'animate-current-line wave-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'raindrop',
    name: 'Raindrop',
    category: 'entrance',
    tag: 'STAGGER',
    description: 'Random-order per-char entrance',
    cssClass: 'animate-current-line raindrop-enter',
    appliesOn: 'active-line',
  },
  {
    id: 'scale-pop',
    name: 'Word Pop Scale',
    category: 'word',
    tag: 'KARAOKE',
    description: 'Per-word spring scale pop during karaoke',
    cssClass: 'word-entrance-box pop-scale-word',
    appliesOn: 'active-word',
  },
  {
    id: 'slide-up',
    name: 'Word Slide Up',
    category: 'word',
    tag: 'KARAOKE',
    description: 'Per-word slide-up during karaoke',
    cssClass: 'word-entrance-box slide-up-word',
    appliesOn: 'active-word',
  },
  {
    id: 'blur-in',
    name: 'Word Blur In',
    category: 'word',
    tag: 'KARAOKE',
    description: 'Per-word blur-in during karaoke',
    cssClass: 'word-entrance-box blur-in-word',
    appliesOn: 'active-word',
  },
  {
    id: 'fade-out-up',
    name: 'Fade Out Up',
    category: 'exit',
    tag: 'EXIT',
    description: 'Fade + rise as the line leaves',
    cssClass: 'animate-exit-line fade-out-up-exit',
    appliesOn: 'active-line',
  },
  {
    id: 'blur-out',
    name: 'Blur Out',
    category: 'exit',
    tag: 'EXIT',
    description: 'Blur + fade as the line leaves',
    cssClass: 'animate-exit-line blur-out-exit',
    appliesOn: 'active-line',
  },
  {
    id: 'scale-out',
    name: 'Scale Out',
    category: 'exit',
    tag: 'EXIT',
    description: 'Scale down + fade as the line leaves',
    cssClass: 'animate-exit-line scale-out-exit',
    appliesOn: 'active-line',
  },
  {
    id: 'typewriter-delete',
    name: 'Typewriter Delete',
    category: 'exit',
    tag: 'EXIT',
    description: 'Char-by-char removal on exit',
    cssClass: 'animate-exit-line typewriter-delete-exit',
    appliesOn: 'active-line',
  },
];

export const ENTRANCE_STYLES = ANIMATION_CATALOG.filter(
  (a) => a.category === 'entrance' || a.id === 'scroll'
);
export const EXIT_STYLES = ANIMATION_CATALOG.filter((a) => a.category === 'exit');
export const WORD_ANIMATIONS = ANIMATION_CATALOG.filter((a) => a.category === 'word');
export const LINE_ANIMATIONS = ANIMATION_CATALOG.filter((a) => a.category === 'line');

export const SPRING_DEFAULTS = {
  damping: 18,
  stiffness: 120,
  mass: 1,
} as const;

export function springValue(
  t: number,
  damping = SPRING_DEFAULTS.damping,
  stiffness = SPRING_DEFAULTS.stiffness,
  mass = SPRING_DEFAULTS.mass
): number {
  if (t <= 0) return 0;
  const omegaN = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta >= 1) {
    if (zeta === 1) {
      return 1 - (1 + omegaN * t) * Math.exp(-omegaN * t);
    }
    const sqrtTerm = Math.sqrt(Math.max(0, zeta * zeta - 1));
    const s1 = -omegaN * (zeta - sqrtTerm);
    const s2 = -omegaN * (zeta + sqrtTerm);
    if (Math.abs(s1 - s2) < 1e-9) {
      return 1 - (1 + omegaN * t) * Math.exp(-omegaN * t);
    }
    return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
  }

  const omegaD = omegaN * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  const expTerm = Math.exp(-zeta * omegaN * t);
  const cosTerm = Math.cos(omegaD * t);
  const sinTerm = Math.sin(omegaD * t);
  const coeff = omegaD > 1e-9 ? (zeta * omegaN) / omegaD : 0;
  return 1 - expTerm * (cosTerm + coeff * sinTerm);
}

export function easeOutBack(t: number, overshoot = 0.22): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.sin(7.5 * Math.PI * t);
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
