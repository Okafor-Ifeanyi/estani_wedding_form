import type { SubmissionStatus } from '../lib/types';
import { STATUS_VALUES } from '../lib/types';

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  NEW: 'New',
  IN_REVIEW: 'In review',
  IN_PROGRESS: 'In progress',
  AWAITING_CLIENT: 'Awaiting client',
  DONE: 'Done',
  ARCHIVED: 'Archived',
};

export { STATUS_VALUES };

export function StatusPill({ status }: { status: SubmissionStatus }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
