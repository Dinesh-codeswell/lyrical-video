export interface BundledFont {
  /** Matches a @font-face font-family name (may differ from cssName for families with spaces). */
  family: string;
  /** Human-readable display name shown in the picker. */
  label: string;
  /** Category for filtering / badges. */
  category: 'sans' | 'serif' | 'condensed' | 'handwritten' | 'mono';
  /** Genre this font best serves (from the plan's style reference table). */
  genre: 'pop' | 'trap' | 'lofi' | 'edm' | 'cinematic' | 'cyberpunk' | 'neutral';
  /** Weights bundled as static TTFs. Controls which weight options appear in the picker. */
  weights: FontWeight[];
  /** Default weight when the user hasn't picked one. */
  defaultWeight: number;
  /** Whether the family supports italic (bundled or faux). */
  hasItalic: boolean;
  /** CSS file path to the bundled TTF (relative to web/public). */
  ttfPath: (weight: number) => string;
}

export type FontWeight = 400 | 700 | 900;

/**
 * Bundled OFL font library.
 *
 * Fonts are self-hosted in web/public/fonts/*.ttf (no CDN dependency).
 * The same TTF files are used by the Python renderer (src/render/fonts.py) so
 * the preview and the final render use identical glyph metrics.
 */
export const BUNDLED_FONTS: BundledFont[] = [
  {
    family: 'Inter',
    label: 'Inter',
    category: 'sans',
    genre: 'neutral',
    weights: [400, 700, 900],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/Inter-${w}.ttf`,
  },
  {
    family: 'Anton',
    label: 'Anton',
    category: 'condensed',
    genre: 'trap',
    weights: [400],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/Anton-${w}.ttf`,
  },
  {
    family: 'Montserrat',
    label: 'Montserrat',
    category: 'sans',
    genre: 'pop',
    weights: [400, 700],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/Montserrat-${w}.ttf`,
  },
  {
    family: 'Playfair Display',
    label: 'Playfair Display',
    category: 'serif',
    genre: 'cinematic',
    weights: [400, 700],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/PlayfairDisplay-${w}.ttf`,
  },
  {
    family: 'Caveat',
    label: 'Caveat',
    category: 'handwritten',
    genre: 'lofi',
    weights: [400],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/Caveat-${w}.ttf`,
  },
  {
    family: 'JetBrains Mono',
    label: 'JetBrains Mono',
    category: 'mono',
    genre: 'cyberpunk',
    weights: [400, 700],
    defaultWeight: 400,
    hasItalic: false,
    ttfPath: (w) => `/fonts/JetBrainsMono-${w}.ttf`,
  },
];

/** Every font family name that has a bundled @font-face declaration. */
export const BUNDLED_FONT_FAMILIES = BUNDLED_FONTS.map((f) => f.family);

/**
 * Register @font-face at runtime by injecting a <style> block into the document
 * head. This is idempotent — calling it twice produces a single style block.
 *
 * The TTF URLs are absolute-paths from the web root (e.g. /fonts/Inter-400.ttf),
 * which Vite serves from web/public/.
 */
export function registerFontFaces(): void {
  if (document.getElementById('lv-bundle-fonts') != null) return;

  const rules = BUNDLED_FONTS
    .flatMap((font) =>
      font.weights.map((weight) => {
        const url = font.ttfPath(weight);
        // font-family is the bare family name (spaces included); CSS handles it.
        const name = font.family.replace(/\s+/g, ' ');
        return `
          @font-face {
            font-family: "${name}";
            font-style: normal;
            font-weight: ${weight};
            font-display: swap;
            src: url("${url}") format("truetype");
          }`.trim();
      })
    )
    .join('\n');

  const style = document.createElement('style');
  style.id = 'lv-bundle-fonts';
  style.textContent = rules;
  document.head.appendChild(style);
}

/** Look up a bundled font by its family name. Returns undefined for non-bundled families (e.g. Arial). */
export function findBundledFont(family: string): BundledFont | undefined {
  return BUNDLED_FONTS.find((f) => f.family.toLowerCase() === family.toLowerCase());
}
