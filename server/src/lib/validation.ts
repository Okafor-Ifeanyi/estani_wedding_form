import { z } from 'zod';
import { FORM_SCHEMA, ARRAY_FIELDS, FILE_FIELDS } from './formSchema.js';
import type { AnswerValue } from './formSchema.js';

// All known, storable (non-file) field names.
const KNOWN_FIELDS = new Set<string>(
  FORM_SCHEMA.flatMap((s) => s.fields.map((f) => f.name)).filter((n) => !FILE_FIELDS.includes(n)),
);

// A single answer is either a string or an array of strings (checkbox groups).
const answerSchema = z.union([z.string(), z.array(z.string())]);

/** The cleaned answer set stored in `Submission.data`. */
export type SubmissionData = Record<string, AnswerValue>;

export const submissionSchema = z.object({
  // The full answer set, keyed by field name. Unknown keys are dropped rather
  // than rejected so an older client never breaks against a newer server.
  data: z
    .record(z.string(), answerSchema)
    .transform((raw): SubmissionData => {
      const clean: SubmissionData = {};
      for (const [key, value] of Object.entries(raw)) {
        if (!KNOWN_FIELDS.has(key)) continue;
        if (ARRAY_FIELDS.includes(key)) {
          clean[key] = Array.isArray(value) ? value : [value];
        } else {
          clean[key] = Array.isArray(value) ? value.join(', ') : value;
        }
      }
      return clean;
    }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SUBMISSION_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'IN_PROGRESS',
  'AWAITING_CLIENT',
  'DONE',
  'ARCHIVED',
] as const;

export type SubmissionStatusValue = (typeof SUBMISSION_STATUSES)[number];

export const statusSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
