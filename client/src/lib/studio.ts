// Studio-owned details shown at the top of the intake form.
//
// These are the two things to fill in before going live: where the "book a
// session" button sends people, and the sample sites you want to show off.

/**
 * Where the "Book a session" button goes — a Calendly/Cal.com link, a
 * WhatsApp deep link, or a mailto:. Anything a browser can open.
 *
 * TODO: replace with the studio's real booking link.
 */
export const BOOKING_URL = 'https://calendly.com/your-studio/wedding-site-session';

/** Shown under the button, so people know what booking gets them. */
export const BOOKING_NOTE = 'About 30 minutes, on a call or WhatsApp.';

export interface SampleSite {
  /** Couple or style name, e.g. "Esther & Ifeanyi". */
  name: string;
  /** One line on what the site is. */
  blurb: string;
  /**
   * The site's palette. The first colour is the card's background — the link
   * wears the theme of the site it opens — and the other two are its accents.
   */
  swatches: [string, string, string];
  /**
   * The live site this card opens in a new tab. Required — every sample is a
   * link, so a new entry cannot be added without saying where it goes.
   */
  url: string;
}

/**
 * TODO: swap each `url` for the couple's real site (and add your own samples).
 * The two placeholders below are not live yet.
 */
export const SAMPLE_SITES: SampleSite[] = [
  {
    name: 'Esther & Ifeanyi',
    blurb: 'Traditional marriage, wax-seal envelope, burgundy and powder blue.',
    swatches: ['#5B1A2E', '#BBD3E2', '#B08D57'],
    url: 'https://estanyi26.vercel.app',
  },
  {
    name: 'Adaeze & Chuka. Coming Soon',
    blurb: 'Church wedding and reception, emerald and gold, live stream built in.',
    swatches: ['#1F4636', '#D9C08C', '#EFEAE0'],
    url: 'coming soon',
  },
  {
    name: 'Ngozi & Emeka. Coming Soon',
    blurb: 'Ivory and sage, quiet and editorial, with a full order of the day.',
    swatches: ['#F1EDE3', '#8B9B7E', '#C9A66B'],
    url: 'coming soon',
  },
];

/** The CSS custom properties a sample card is painted with. */
export interface SampleTheme {
  /** Card background — the site's own base colour. */
  bg: string;
  /** Secondary background, for the card's soft gradient. */
  bgSoft: string;
  /** Body text that stays readable on `bg`. */
  ink: string;
  /** Quieter text (the blurb) on `bg`. */
  inkMuted: string;
  /** Hairline border and rules on `bg`. */
  edge: string;
  /** The palette's accent, used for the ring that lights up on hover. */
  accent: string;
  /** The colour of the sheen that sweeps across the card on hover. */
  sheen: string;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(hex: string, toward: string, amount: number): string {
  const a = channels(hex);
  const b = channels(toward);
  const parts = a.map((c, i) => Math.round(c + ((b[i] as number) - c) * amount));
  return `rgb(${parts.join(', ')})`;
}

/**
 * Dress a card in the site's own theme. Light palettes keep the form's ink;
 * dark ones flip to warm white, so every card clears a readable contrast
 * whatever the couple's colours turn out to be.
 */
export function sampleTheme(sample: SampleSite): SampleTheme {
  const [base, , accent] = sample.swatches;
  const light = luminance(base) > 0.42;
  return {
    bg: base,
    // A quiet drift toward the third colour, so the card reads as a palette
    // rather than a flat block.
    bgSoft: mix(base, accent, light ? 0.16 : 0.24),
    ink: light ? '#201f1d' : '#fdfaf6',
    inkMuted: light ? 'rgba(32, 31, 29, 0.68)' : 'rgba(253, 250, 246, 0.76)',
    edge: light ? 'rgba(32, 31, 29, 0.16)' : 'rgba(253, 250, 246, 0.28)',
    accent,
    // A highlight has to be brighter than what it crosses; light cards need a
    // stronger one to register at all.
    sheen: light ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.16)',
  };
}
