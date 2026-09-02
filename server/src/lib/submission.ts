import {
  FORM_SCHEMA,
  FIELD_LABELS,
  ARRAY_FIELDS,
  countedRepeatRows,
  hasAnswer,
  repeatRowOf,
} from './formSchema.js';
import type { AnswerValue } from './formSchema.js';
import type { SubmissionData } from './validation.js';

export interface AnsweredCount {
  answered: number;
  total: number;
}

/**
 * Count how many fields have a non-empty answer. Repeat rows (story chapters,
 * order of the day) count for the default run plus any further row the guest
 * actually filled in — the rows they never opened aren't held against them.
 */
export function countAnswered(data: SubmissionData): AnsweredCount {
  let answered = 0;
  let total = 0;
  for (const section of FORM_SCHEMA) {
    const countedRows = section.repeat ? countedRepeatRows(section, data) : 0;
    for (const field of section.fields) {
      if (repeatRowOf(section, field) > countedRows) continue;
      total += 1;
      if (hasAnswer(data[field.name])) answered += 1;
    }
  }
  return { answered, total };
}

/** The queryable columns mirrored out of the answer set. */
export interface PromotedColumns {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactRole: string | null;
  domain: string | null;
  deadline: string | null;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string | null;
  guestCount: number | null;
}

/**
 * Derive the promoted, queryable columns from the full answer set.
 */
export function promotedColumns(data: SubmissionData): PromotedColumns {
  const guestCountRaw = data.guest_count;
  const guestCount =
    guestCountRaw != null && guestCountRaw !== '' ? Number(guestCountRaw) : null;
  return {
    contactName: str(data.contact_name),
    contactEmail: str(data.contact_email),
    contactPhone: str(data.contact_phone),
    contactRole: str(data.contact_role),
    domain: str(data.domain),
    deadline: str(data.deadline),
    brideName: str(data.bride_full) || str(data.bride_short),
    groomName: str(data.groom_full) || str(data.groom_short),
    weddingDate: str(data.wedding_date),
    guestCount: guestCount != null && Number.isFinite(guestCount) ? guestCount : null,
  };
}

function str(v: AnswerValue | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * The shape `buildBrief` needs. Kept structural rather than tied to a Prisma
 * payload type so it works for both the stored row and the include-with-files
 * query in the admin route.
 */
export interface BriefSubmission {
  createdAt: Date | string;
  answered: number;
  total: number;
  /** Prisma hands `data` back as JSON, so it arrives untyped. */
  data: unknown;
  files?: { originalName: string; field: string }[] | null;
}

/**
 * Build a plain-text brief, section by section — the same document the
 * original prototype produced client-side, now generated from stored data so
 * the studio has a canonical copy.
 */
export function buildBrief(submission: BriefSubmission): string {
  const data = (submission.data ?? {}) as SubmissionData;
  const lines: string[] = [
    'WEDDING SITE BRIEF',
    `Submitted ${new Date(submission.createdAt).toLocaleString()}`,
    '',
  ];

  for (const section of FORM_SCHEMA) {
    const block: string[] = [];
    for (const field of section.fields) {
      const value = data[field.name];
      const printed = formatValue(value);
      if (!printed) continue;
      block.push(`  ${FIELD_LABELS[field.name] || field.name}: ${printed}`);
    }
    if (!block.length) continue;
    lines.push(section.title.toUpperCase());
    lines.push(block.join('\n'));
    lines.push('');
  }

  if (submission.files && submission.files.length) {
    lines.push('FILES ATTACHED');
    for (const f of submission.files) lines.push(`  - ${f.originalName} (${f.field})`);
    lines.push('');
  }

  lines.push(`Answered ${submission.answered} of ${submission.total} fields.`);
  return lines.join('\n');
}

function formatValue(value: AnswerValue | undefined): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(' · ');
  return String(value).trim();
}

export { ARRAY_FIELDS };
