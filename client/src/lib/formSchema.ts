// Canonical definition of the intake form.
//
// This single file is the source of truth for: rendering the public form
// (client), building the human-readable brief (client + server), and knowing
// which fields are arrays / files (server). Keep client and server copies
// identical — they are the same file copied into both packages.

/** Input types the renderer knows how to draw. */
export type SimpleFieldType = 'text' | 'email' | 'tel' | 'url' | 'date' | 'time' | 'number';

/** Properties every field carries, whatever its type. */
interface FieldBase {
  name: string;
  label: string;
  placeholder?: string;
  /** Render full-width instead of in the two-column grid. */
  full?: boolean;
  /** Fields sharing a `row` id are laid out on one line (timeline / order of day). */
  row?: string;
  /** Heading shown above the first field of a row. */
  groupLabel?: string;
}

export interface SimpleField extends FieldBase {
  type: SimpleFieldType;
}

export interface TextareaField extends FieldBase {
  type: 'textarea';
  rows?: number;
}

export interface SelectField extends FieldBase {
  type: 'select';
  options: string[];
}

export interface CheckboxOption {
  value: string;
  label: string;
}

export interface CheckboxField extends FieldBase {
  type: 'checkbox';
  options: CheckboxOption[];
}

export interface RadioOption {
  value: string;
  /** Colour chips shown beside the option. Empty for the "custom" choice. */
  swatches?: string[];
}

export interface RadioField extends FieldBase {
  type: 'radio';
  options: RadioOption[];
}

export interface ColorField extends FieldBase {
  type: 'color';
  default?: string;
}

export interface FileField extends FieldBase {
  type: 'file';
  accept?: string;
  multiple?: boolean;
}

/**
 * A field, discriminated on `type`. Narrow with `field.type === '...'` (not a
 * destructured `type`, which narrows the local only) to reach the extra props.
 */
export type FormField =
  | SimpleField
  | TextareaField
  | SelectField
  | CheckboxField
  | RadioField
  | ColorField
  | FileField;

/**
 * A run of identical rows the guest can grow — story chapters, order of the
 * day. The schema always carries fields for `max` rows so the server can label
 * and validate every one of them; the form starts by showing `initial` and
 * reveals the rest one at a time as the guest asks for them.
 */
export interface RepeatGroup {
  /** Row ids in the group are `${prefix}${n}`, n starting at 1. */
  prefix: string;
  /** Rows shown before the guest adds any. */
  initial: number;
  /** Hard ceiling — the schema holds fields for exactly this many rows. */
  max: number;
  /** Label on the add button. */
  addLabel: string;
  /** Plural noun for the "4 of 10 shown" counter. */
  nounPlural: string;
}

export interface FormSection {
  id: string;
  number: string;
  title: string;
  intro?: string;
  fields: FormField[];
  /** Present when the section carries a growable run of rows. */
  repeat?: RepeatGroup;
}

/** One answer: free text, or the checked values of a checkbox group. */
export type AnswerValue = string | string[];

/** A complete (or partial) answer set, keyed by field name. */
export type FormValues = Record<string, AnswerValue | undefined>;

/** Story chapters: four to start, up to ten. */
export const STORY_CHAPTERS: RepeatGroup = {
  prefix: 'ch',
  initial: 4,
  max: 10,
  addLabel: 'Add another chapter',
  nounPlural: 'chapters',
};

/** Order of the day: six to start, up to sixteen. */
export const ORDER_ITEMS: RepeatGroup = {
  prefix: 'ood',
  initial: 6,
  max: 16,
  addLabel: 'Add another item',
  nounPlural: 'items',
};

// Sample years/titles for the first few chapters; later ones fall back to
// generic hints so an added chapter never looks half-finished.
const CHAPTER_HINTS: Array<{ year: string; title: string }> = [
  { year: '2026', title: 'The first sight' },
  { year: '2028', title: 'Falling deeper' },
  { year: '2030', title: 'Building our nest' },
  { year: '2031', title: 'He asked, she said yes' },
  { year: '2032', title: 'Forever begins' },
];

const ORDER_HINTS: Array<{ time: string; title: string }> = [
  { time: '2:30 PM', title: 'Arrival & seating' },
  { time: '3:00 PM', title: 'Ceremony begins' },
  { time: '4:00 PM', title: 'Photographs' },
  { time: '5:00 PM', title: 'Reception opens' },
  { time: '6:00 PM', title: 'Speeches & toasts' },
  { time: '7:30 PM', title: 'First dance' },
];

function chapterFields(n: number): FormField[] {
  const hint = CHAPTER_HINTS[n - 1] ?? { year: '', title: 'A moment worth keeping' };
  return [
    { groupLabel: `Chapter ${n}`, name: `ch${n}_year`, label: `Chapter ${n} — year`, type: 'text', placeholder: hint.year || 'Year', row: `ch${n}` },
    { name: `ch${n}_title`, label: `Chapter ${n} — title`, type: 'text', placeholder: hint.title, row: `ch${n}` },
    { name: `ch${n}_note`, label: `Chapter ${n} — note`, type: 'text', placeholder: 'One or two lines', row: `ch${n}` },
  ];
}

function orderFields(n: number): FormField[] {
  const hint = ORDER_HINTS[n - 1] ?? { time: 'Time', title: 'What happens next' };
  return [
    { groupLabel: `Item ${n}`, name: `ood${n}_time`, label: `Item ${n} — time`, type: 'text', placeholder: hint.time, row: `ood${n}` },
    { name: `ood${n}_title`, label: `Item ${n} — title`, type: 'text', placeholder: hint.title, row: `ood${n}` },
    { name: `ood${n}_note`, label: `Item ${n} — note`, type: 'text', placeholder: 'Short description', row: `ood${n}` },
  ];
}

/** 1..n, for generating a repeat group's rows. */
function rowsUpTo(max: number): number[] {
  return Array.from({ length: max }, (_, i) => i + 1);
}

export const FORM_SCHEMA: FormSection[] = [
  {
    id: 'contact',
    number: '01',
    title: 'Your contact',
    intro: 'So we know who to send the draft link to.',
    fields: [
      { name: 'contact_name', label: 'Your name', type: 'text', placeholder: 'Chidinma Okeke' },
      { name: 'contact_email', label: 'Email', type: 'email', placeholder: 'you@email.com' },
      { name: 'contact_phone', label: 'Phone / WhatsApp', type: 'tel', placeholder: '+234 800 000 0000' },
      {
        name: 'contact_role',
        label: 'Who are you to the couple?',
        type: 'select',
        options: ['I am the bride', 'I am the groom', 'Planner or coordinator', 'Family member', 'Friend of the couple'],
      },
      { name: 'deadline', label: 'When do you need it live?', type: 'date' },
      { name: 'domain', label: 'Preferred web address', type: 'text', placeholder: 'estherandifeanyi.com' },
    ],
  },
  {
    id: 'couple',
    number: '02',
    title: 'The couple',
    intro: 'Names as you want them printed. The short names are what appear large on the cover.',
    fields: [
      { name: 'bride_full', label: 'Bride — full name', type: 'text', placeholder: 'Esther Adaeze Nwosu' },
      { name: 'bride_short', label: 'Bride — name on the cover', type: 'text', placeholder: 'Esther' },
      { name: 'groom_full', label: 'Groom — full name', type: 'text', placeholder: 'Ifeanyi Chukwuemeka Obi' },
      { name: 'groom_short', label: 'Groom — name on the cover', type: 'text', placeholder: 'Ifeanyi' },
      { name: 'monogram', label: 'Monogram / seal letters', type: 'text', placeholder: 'E & I' },
      { name: 'hashtag', label: 'Couple name or hashtag', type: 'text', placeholder: 'Estanyi2032' },
      { name: 'cover_line', label: 'Line for the cover, under your names', type: 'text', placeholder: 'Invite you to celebrate their traditional marriage', full: true },
    ],
  },
  {
    id: 'story',
    number: '03',
    title: 'Your story',
    intro: 'Write it however it comes out — rough notes are fine, we will shape the prose. Four chapters to start; add more if your story needs them.',
    repeat: STORY_CHAPTERS,
    fields: [
      { name: 'story_met', label: 'How you met', type: 'textarea', rows: 4, placeholder: 'Where, when, who spoke first, what you remember most', full: true },
      { name: 'story_proposal', label: 'The proposal', type: 'textarea', rows: 4, placeholder: 'How he asked, where, who was there, how she answered', full: true },
      ...rowsUpTo(STORY_CHAPTERS.max).flatMap(chapterFields),
      { name: 'quote', label: 'A verse, proverb or quote you want on the page', type: 'text', placeholder: 'Song of Solomon 3:4 — I have found the one whom my soul loves', full: true },
    ],
  },
  {
    id: 'day',
    number: '04',
    title: 'The wedding day',
    fields: [
      {
        name: 'events',
        label: 'Which celebrations are you inviting people to?',
        type: 'checkbox',
        full: true,
        options: [
          { value: 'Traditional marriage / Igba Nkwu', label: 'Traditional marriage' },
          { value: 'Church wedding', label: 'Church wedding' },
          { value: 'Court / civil', label: 'Court or civil' },
          { value: 'Reception', label: 'Reception' },
          { value: 'After-party', label: 'After-party' },
        ],
      },
      { name: 'wedding_date', label: 'Date', type: 'date' },
      { name: 'ceremony_time', label: 'Ceremony starts', type: 'time' },
      { name: 'arrival_time', label: 'Guests should arrive by', type: 'time' },
      { name: 'venue_name', label: 'Ceremony venue — name', type: 'text', placeholder: 'St. Francis Parish' },
      { name: 'venue_address', label: 'Ceremony venue — full address', type: 'text', placeholder: 'Enugwu-Ukwu, Njikoka, Anambra State' },
      { name: 'reception', label: 'Reception venue & time', type: 'text', placeholder: 'Family compound, 6:00 PM' },
      { name: 'maps_link', label: 'Google Maps link, if you have one', type: 'url', placeholder: 'https://maps.google.com/...' },
      { name: 'directions', label: 'Parking, directions or landmarks worth noting', type: 'textarea', rows: 3, placeholder: 'Turn at the junction by the market, parking behind the parish hall', full: true },
    ],
  },
  {
    id: 'order',
    number: '05',
    title: 'Order of the day',
    intro: 'Six slots to start — add more if the day runs longer. Fill only the rows you need; we will trim the timeline to fit.',
    repeat: ORDER_ITEMS,
    fields: rowsUpTo(ORDER_ITEMS.max).flatMap(orderFields),
  },
  {
    id: 'people',
    number: '06',
    title: 'Parents',
    fields: [
      { name: 'bride_parents', label: "Bride's parents", type: 'text', placeholder: 'Mr & Mrs Nwosu' },
      { name: 'groom_parents', label: "Groom's parents", type: 'text', placeholder: 'Mr & Mrs Obi' },
      { name: 'party_leads', label: 'Chief bridesmaid / best man', type: 'text', placeholder: 'Amaka Eze & Uche Nnamdi' },
      { name: 'day_contact', label: 'Who guests should call on the day', type: 'text', placeholder: 'Name & number' },
      { name: 'bridal_party', label: 'Bridal party, if you want them listed', type: 'textarea', rows: 3, placeholder: 'Names, one per line', full: true },
    ],
  },
  {
    id: 'dress',
    number: '07',
    title: 'Dress code',
    intro: 'Your guest colours appear on the site as spheres guests can match against. Tap a swatch to pick, or type the hex code if you already have it.',
    fields: [
      { name: 'guest_color_1', label: 'Guest colour 1', type: 'color', default: '#5b1a2e' },
      { name: 'guest_color_2', label: 'Guest colour 2', type: 'color', default: '#bbd3e2' },
      { name: 'guest_color_3', label: 'Guest colour 3', type: 'color', default: '#b08d57' },
      { name: 'guest_color_names', label: 'Colour names, as guests say them', type: 'text', placeholder: 'Burgundy, powder blue, gold' },
      { name: 'attire_note', label: 'Attire guidance', type: 'textarea', rows: 3, placeholder: 'Traditional attire encouraged. Aso-ebi available from the family — contact us before 1 March.', full: true },
      { name: 'asoebi', label: 'Aso-ebi contact or price', type: 'text', placeholder: 'Aunty Ngozi — 0800 000 0000' },
      { name: 'attire_avoid', label: 'Anything guests should avoid wearing', type: 'text', placeholder: 'Please, no white' },
    ],
  },
  {
    id: 'rsvp',
    number: '08',
    title: 'RSVP & gifts',
    fields: [
      { name: 'rsvp_deadline', label: 'RSVP deadline', type: 'date' },
      { name: 'rsvp_target', label: 'Where should replies go?', type: 'text', placeholder: 'Email, WhatsApp number, or a Google Sheet' },
      { name: 'guest_count', label: 'Expected number of guests', type: 'number', placeholder: '250' },
      {
        name: 'plus_ones',
        label: 'Are plus-ones allowed?',
        type: 'select',
        options: ['Yes, freely', 'Only if named on the invitation', 'No plus-ones'],
      },
      {
        name: 'rsvp_fields',
        label: 'What should the RSVP form ask?',
        type: 'checkbox',
        full: true,
        options: [
          { value: 'Name', label: 'Name' },
          { value: 'Number in party', label: 'Number in party' },
          { value: 'Which events attending', label: 'Which events' },
          { value: 'Meal choice', label: 'Meal choice' },
          { value: 'Song request', label: 'Song request' },
          { value: 'Note to the couple', label: 'Note to the couple' },
        ],
      },
      { name: 'gift_bank', label: 'Bank details for gifts', type: 'text', placeholder: 'Bank, account name, account number' },
      { name: 'registry', label: 'Registry or wishlist link', type: 'url', placeholder: 'https://...' },
      { name: 'gift_note', label: 'How you want to word the gift note', type: 'textarea', rows: 3, placeholder: 'Your presence is the gift. For those who insist on more...', full: true },
    ],
  },
  {
    id: 'media',
    number: '09',
    title: 'Pictures, video & music',
    intro: 'Pick your files here so we know what is coming. Large sets are easier by WeTransfer or a shared Drive link.',
    fields: [
      { name: 'photo_hero', label: 'Cover photograph', type: 'file', accept: 'image/*' },
      { name: 'photo_portrait', label: 'Portrait of the two of you', type: 'file', accept: 'image/*' },
      { name: 'photo_gallery', label: 'Gallery — up to twelve', type: 'file', accept: 'image/*', multiple: true },
      { name: 'audio_file', label: 'Music for the site', type: 'file', accept: 'audio/*' },
      { name: 'photo_link', label: 'Or a link to your photo folder', type: 'url', placeholder: 'Drive, Dropbox or WeTransfer link' },
      { name: 'song_name', label: 'Song title, if we should source it', type: 'text', placeholder: 'Artist — title' },
      {
        name: 'music_autoplay',
        label: 'Should the music start on its own?',
        type: 'select',
        options: ['Yes, softly, when the envelope opens', 'Only when a guest presses play', 'No music at all'],
      },
      { name: 'photo_credit', label: 'Photographer credit', type: 'text', placeholder: '@studio' },
    ],
  },
  {
    id: 'look',
    number: '10',
    title: 'Website Theme',
    intro: "What's the theme of the day? Take one of ours, or choose Custom and set your own three colours — tap a swatch to pick, or paste the hex code straight in.",
    fields: [
      {
        name: 'palette',
        label: "What's the theme of the day?",
        type: 'radio',
        full: true,
        options: [
          { value: 'Burgundy & powder blue', swatches: ['#5B1A2E', '#BBD3E2', '#B08D57'] },
          { value: 'Emerald & gold', swatches: ['#1F4636', '#D9C08C', '#EFEAE0'] },
          { value: 'Ivory & sage', swatches: ['#F1EDE3', '#8B9B7E', '#C9A66B'] },
          { value: 'Dusty blue & blush', swatches: ['#5E7A90', '#E7C9C2', '#EDE7DE'] },
          { value: 'Deep plum & champagne', swatches: ['#3E1F3D', '#E4D3B4', '#F2EDE6'] },
          { value: 'Custom — my own colours', swatches: [] },
        ],
      },
      { name: 'custom_primary', label: 'Your main colour', type: 'color', default: '#5b1a2e' },
      { name: 'custom_secondary', label: 'Your second colour', type: 'color', default: '#bbd3e2' },
      { name: 'custom_metal', label: 'Your metallic accent', type: 'color', default: '#b08d57' },
      { name: 'custom_palette_note', label: 'Anything else about your colours?', type: 'text', placeholder: 'Match the aso-ebi exactly, keep the gold subtle…', full: true },
      {
        name: 'title_font',
        label: 'Lettering for your names',
        type: 'select',
        options: ['Flowing script — romantic, calligraphic', 'Classic serif — restrained, editorial', 'Italic serif — soft, understated', 'Surprise us'],
      },
      {
        name: 'ornaments',
        label: 'Ornaments in the margins',
        type: 'select',
        options: ['Eucalyptus & greenery', 'Lilac and soft florals', 'Gold line flourishes', 'None — keep it plain'],
      },
      {
        name: 'envelope',
        label: 'Envelope animation before the site?',
        type: 'select',
        options: ['Yes — wax seal a guest taps to open', 'Yes, but keep it very short', 'No — open straight onto the site'],
      },
      {
        name: 'mood',
        label: 'Overall mood',
        type: 'select',
        options: ['Formal and traditional', 'Romantic and soft', 'Modern and minimal', 'Bold and celebratory'],
      },
      { name: 'inspiration', label: 'Sites or invitations you love', type: 'textarea', rows: 3, placeholder: 'Paste links, or describe what caught your eye', full: true },
    ],
  },
  {
    id: 'extras',
    number: '11',
    title: 'Extras',
    fields: [
      {
        name: 'extras',
        label: 'Sections you want included',
        type: 'checkbox',
        full: true,
        options: [
          'Countdown to the day', 'Map of the venue', 'Photo gallery', 'Guestbook / well-wishes',
          'Hotels and travel', 'Live stream link', 'Frequently asked questions',
          'Password-protected site', 'Igbo / second language version',
        ].map((v) => ({ value: v, label: v })),
      },
      { name: 'hotels', label: 'Hotels or lodging to recommend', type: 'text', placeholder: 'Name, area, rough price' },
      { name: 'stream', label: 'Live stream link', type: 'url', placeholder: 'https://...' },
      { name: 'notes', label: 'Anything else we should know', type: 'textarea', rows: 4, placeholder: 'Family sensitivities, wording to avoid, a detail that matters to you', full: true },
    ],
  },
];

// Field names that hold an array of selected values.
export const ARRAY_FIELDS: string[] = ['events', 'rsvp_fields', 'extras'];

// Field names that are file uploads (handled out of band, not stored in `data`).
export const FILE_FIELDS: string[] = ['photo_hero', 'photo_portrait', 'photo_gallery', 'audio_file'];

// name -> label, flattened, for the brief export.
export const FIELD_LABELS: Record<string, string> = FORM_SCHEMA.reduce<Record<string, string>>(
  (acc, section) => {
    for (const f of section.fields) acc[f.name] = f.label;
    return acc;
  },
  {},
);

/* ---- Repeat groups --------------------------------------------------- */

/** The 1-based row a field sits on in its section's repeat group, else 0. */
export function repeatRowOf(section: FormSection, field: FormField): number {
  const group = section.repeat;
  if (!group || !field.row || !field.row.startsWith(group.prefix)) return 0;
  const n = Number(field.row.slice(group.prefix.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** The highest repeat row that has an answer in it; 0 when none do. */
export function filledRepeatRows(section: FormSection, values: FormValues): number {
  let highest = 0;
  for (const field of section.fields) {
    const row = repeatRowOf(section, field);
    if (!row || row <= highest) continue;
    if (hasAnswer(values[field.name])) highest = row;
  }
  return highest;
}

/**
 * How many repeat rows count toward the progress meter: the default run,
 * stretched to cover anything the guest actually filled in. `open` lets the
 * client widen it further to rows it is showing but that are still blank.
 */
export function countedRepeatRows(
  section: FormSection,
  values: FormValues,
  open?: number,
): number {
  const group = section.repeat;
  if (!group) return 0;
  return Math.min(
    group.max,
    Math.max(group.initial, open ?? 0, filledRepeatRows(section, values)),
  );
}

/** Whether a field is on screen (or worth counting) given the rows in play. */
export function isCountedField(
  section: FormSection,
  field: FormField,
  countedRows: number,
): boolean {
  const row = repeatRowOf(section, field);
  return row === 0 || row <= countedRows;
}

/** True when an answer holds something. Shared so every counter agrees. */
export function hasAnswer(value: AnswerValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null && String(value).trim() !== '';
}

// The number of "answerable" fields a guest sees before adding any rows —
// files excluded, hidden repeat rows excluded.
export const TOTAL_FIELDS: number = FORM_SCHEMA.reduce(
  (n, s) =>
    n + s.fields.filter((f) => isCountedField(s, f, s.repeat ? s.repeat.initial : 0)).length,
  0,
);
