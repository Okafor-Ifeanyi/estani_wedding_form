// Shapes the API returns. These mirror the server's Prisma models — the fields
// each endpoint actually selects, not the full row.

import type { AnswerValue } from './formSchema';

export const STATUS_VALUES = [
  'NEW',
  'IN_REVIEW',
  'IN_PROGRESS',
  'AWAITING_CLIENT',
  'DONE',
  'ARCHIVED',
] as const;

export type SubmissionStatus = (typeof STATUS_VALUES)[number];

/** The status tabs on the dashboard, including the catch-all. */
export type StatusFilter = SubmissionStatus | 'ALL';

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** One row of the dashboard list. */
export interface SubmissionRow {
  id: string;
  createdAt: string;
  status: SubmissionStatus;
  contactName: string | null;
  contactEmail: string | null;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string | null;
  domain: string | null;
  answered: number;
  total: number;
  _count: { notes: number; files: number };
}

export interface FollowUpNote {
  id: string;
  createdAt: string;
  body: string;
  author?: { name: string } | null;
}

export interface MediaFile {
  id: string;
  createdAt: string;
  field: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

/** A submission with everything the detail page shows. */
export interface SubmissionDetailData {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SubmissionStatus;
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
  data: Record<string, AnswerValue | undefined>;
  answered: number;
  total: number;
  notes: FollowUpNote[];
  files: MediaFile[];
}

export interface SubmissionListResponse {
  rows: SubmissionRow[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  statusCounts: Partial<Record<SubmissionStatus, number>>;
}

export interface LoginResponse {
  token: string;
  admin: Admin;
}
